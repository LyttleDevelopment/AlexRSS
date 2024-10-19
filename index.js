import { Client, EmbedBuilder, GatewayIntentBits, Partials } from "discord.js";
import fs from "fs";
import Parser from "rss-parser";

let booted = false;
let parser = new Parser();

const saveConfig = () => {
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
  console.log("Saved config");
};

export const client = new Client({
  allowedMentions: { parse: [] },
  partials: [Partials.Message, Partials.Channel],
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isCommand()) return;
    await interaction.deferReply();

    if (running) {
      await interaction.editReply("Bot is busy, try again later");
      return;
    }
    const addFeed = async (interaction) => {
      await interaction.editReply("Searching...");
      const userUrls = interaction.options.getString("link");
      let channel = interaction.options.getChannel("channel");
      if (!channel) channel = interaction.channel;
      if (!channel) return interaction.editReply("Unknown channel");
      if (!userUrls) return interaction.editReply("Unknown url");

      let urls = userUrls.split("http").map((item) => "http" + item);
      urls = urls.filter((item) => item !== "http" || item !== "https");
      for (let url of urls) {
        config.findIndex(
          (item) => item.channel === channel.id && item.url === url
        ) === -1 &&
          config.push({
            channel: channel.id,
            url,
            last: [],
          });
      }
      saveConfig();
      await interaction.editReply("Created!");
    };

    const removeFeed = async (interaction) => {
      await interaction.editReply("Searching...");
      const url = interaction.options.getString("link");
      let channel = interaction.options.getChannel("channel");
      if (!channel) channel = interaction.channel;
      if (!channel) return interaction.editReply("Unknown channel");
      if (!url) return interaction.editReply("Unknown url");

      config.findIndex(
        (item) => item.channel === channel.id && item.url === url
      ) !== -1 &&
        config.splice(
          config.findIndex(
            (item) => item.channel === channel.id && item.url === url
          ),
          1
        );
      saveConfig();
      await interaction.editReply("Removed!");
    };

    const listFeed = async (interaction) => {
      await interaction.editReply("Listing...");
      let channel = interaction.options.getChannel("channel");
      if (!channel) channel = interaction.channel;
      if (!channel) return interaction.editReply("Unknown channel");

      let feeds = config.filter((item) => item.channel === channel.id);
      feeds = feeds.reverse();

      let message = `# <#${channel.id}> has **${feeds.length}** feeds:\n\n`;
      for (let feed of feeds) {
        message += `> <#${feed.channel}>: **<${feed.url}>** (last: <${feed.last}>)\n\n`;
      }

      await interaction.editReply({ content: message });
    };

    const refreshFeed = async (interaction) => {
      const startDate = new Date();
      await interaction.editReply("Refreshing... ||(You d*ck)||");
      await app(interaction);
      delete messageQueue[interaction.channelId];
      const endDate = new Date();
      await interaction.editReply(
        "Done, took **" + (endDate - startDate) + "ms**"
      );
    };

    if (interaction.commandName === "addfeed") return addFeed(interaction);
    if (interaction.commandName === "removefeed")
      return removeFeed(interaction);
    if (interaction.commandName === "listfeed") return listFeed(interaction);
    if (interaction.commandName === "refreshfeed")
      return refreshFeed(interaction);
    return interaction.editReply("Unknown command");
  } catch (e) {
    console.log(e);
  }
});

// Login to Discord with your client's token
client
  .login(
    process.env.BOT_TOKEN
  )
  .then(() => {
    booted = true;
    console.log("running");
    client.user.setStatus("idle");
    setTimeout(() => void app(), 1000);
  });

let running = false;
let config = [];

const createId = (item) => {
  const url = item.link || item.url || item.href || null;
  const date = item.pubDate || item.isoDate || item.update || null;
  return date + "-" + url;
};

const app = async (interaction = null) => {
  if (!booted) return;
  if (running) return;
  running = true;
  console.log("Reading config..");
  config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

  for (let check of config) {
    try {
      if (interaction) {
        const message = `Refreshing: <#${check.channel}>: ${check.url}`;
        const channel = interaction.channelId;
        if (!messageQueue[channel])
          messageQueue[channel] = {
            message,
            interaction,
          };
        else messageQueue[channel].message += "\n" + message;
      }
      let feed = await parser.parseURL(check.url);

      console.log("Checking:", check.channel, check.url);

      let items = feed.items;
      items = items.sort((a, b) => {
        // sort oldest to newest by id
        return createId(a) - createId(b);
      });
      items = items.sort((a, b) => {
        // sort oldest to newest
        if (a.pubDate && b.pubDate)
          return new Date(a.pubDate) - new Date(b.pubDate);
        if (a.updated && b.updated)
          return new Date(a.updated) - new Date(b.updated);
        if (a.isoDate && b.isoDate)
          return new Date(a.isoDate) - new Date(b.isoDate);
        if (a.link && b.link) return a.link - b.link;
        return 0;
      });

      // If items got lost, reset items
      if (items.length !== feed.items.length) items = feed.items;

      // Get last items from config.
      const lastItems = Array.isArray(check.last) ? check.last : [];
      const isNewFeed = lastItems?.length < 1 ?? true;

      // Find all new items
      const newItems = items.filter((item) => {
        const id = createId(item);
        return !lastItems.includes(id);
      });

      if (newItems.length < 1) continue;

      // Add new items to last items
      lastItems.push(...newItems.map((item) => createId(item)));
      // Remove old items
      if (lastItems.length > 100) lastItems.splice(0, lastItems.length - 100);
      // Save last items
      config[config.indexOf(check)].last = lastItems;

      // If the feed is new, skip sending messages
      if (isNewFeed) continue;

      const channel = client.channels.cache.get(check.channel);

      if (!channel?.isTextBased) continue;

      for (let item of newItems) {
        if (!item) continue;
        queue.push(() => {
          try {
            const task = async () => {
              const embed = new EmbedBuilder()
                .setColor("#ea7818")
                .setFooter({
                  text: "By Lyttle Development & MelonCo",
                })
                .setTimestamp(
                  item.pubDate || item.isoDate
                    ? new Date(item.pubDate || item.isoDate)
                    : new Date()
                );

              const author = item.author || item.creator || null;
              const title = item.title || item.name || null;
              let description =
                item.description ||
                item.contentSnippet ||
                item.summary ||
                item.content ||
                null;

              // remove "View Post" from message
              if (description) {
                description = description.split("\nView Post\n").join("\n");
                description = description.split("View Post").join("");

                // limit to 1500 characters
                description = description.substring(0, 1500);
              }

              const url = item.link || item.url || item.href || null;
              const image =
                item.image || item.enclosure?.url || item.image?.url || null;

              if (author) embed.setAuthor({ name: author });
              if (title) embed.setTitle(title);
              if (description) embed.setDescription(description);
              if (image) embed.setImage(image);
              if (url) embed.setURL(url);
              if (url && !image) {
                try {
                  const res = await fetch(url);
                  const html = await res.text();
                  let imageCache = null;
                  let image = null;
                  try {
                    if (html.includes("twitter:image")) {
                      imageCache = html
                        .split('twitter:image" content="')[1]
                        .split('"')[0];
                      if (imageCache) image = imageCache;
                    }
                  } catch (e) {}
                  try {
                    if (html.includes("og:image:secure_url")) {
                      imageCache = html
                        .split('og:image:secure_url" content="')[1]
                        .split('"')[0];
                      if (imageCache) image = imageCache;
                    }
                  } catch (e) {}
                  try {
                    if (html.includes("og:image:url")) {
                      imageCache = html
                        .split('og:image:url" content="')[1]
                        .split('"')[0];
                      if (imageCache) image = imageCache;
                    }
                  } catch (e) {}
                  try {
                    if (html.includes("og:image")) {
                      imageCache = html
                        .split('og:image" content="')[1]
                        .split('"')[0];
                      if (imageCache) image = imageCache;
                    }
                  } catch (e) {}
                  try {
                    if (html.includes("image")) {
                      imageCache = html
                        .split('image" content="')[1]
                        .split('"')[0];
                      if (imageCache) image = imageCache;
                    }
                  } catch (e) {}
                  if (image) embed.setImage(image);
                } catch (e) {
                  await channel.send({ content: url });
                  return;
                }
              }

              // Send message
              await channel.send({ embeds: [embed] });
            };
            void task();
          } catch (e) {}
        });
      }
    } catch (e) {
      console.log(e);
    }
  }

  saveConfig();
  setTimeout(() => (running = false), 1000);
};

setInterval(app, 5 * 60 * 1000);

const queue = [];
const messageQueue = {};
setInterval(() => {
  if (!booted) return;
  const message = queue.length + " queued posts";
  console.log(message);
  client.user.setActivity({
    name: message,
    type: 1,
    url: "https://www.twitch.tv/stualyttle",
  });
  try {
    const queueItem = queue.shift();
    if (!queueItem) return;
    queueItem();
  } catch (e) {}
}, 5000);

setInterval(() => {
  if (!booted) return;
  try {
    const queueItem = Object.keys(messageQueue)[0] || null;
    if (!queueItem) return;
    const obj = messageQueue[queueItem];
    const message = obj.message;
    const interaction = obj.interaction;
    void interaction.editReply(message);
    delete messageQueue[queueItem];
  } catch (e) {}
}, 2500);
