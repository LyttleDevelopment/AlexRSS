import process from "process";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

export const addCommand = new SlashCommandBuilder()
  .setName("addfeed")
  .setDescription("Add add new RSS feed")
  .addStringOption((option) =>
    option
      .setName("link")
      .setDescription("Add one other member")
      .setRequired(true)
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Add 2 members to check against")
      .setRequired(false)
  );
export const removeCommand = new SlashCommandBuilder()
  .setName("removefeed")
  .setDescription("Remove a RSS feed")
  .addStringOption((option) =>
    option
      .setName("link")
      .setDescription("Add one other member")
      .setRequired(true)
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Add 2 members to check against")
      .setRequired(false)
  );
export const listCommand = new SlashCommandBuilder()
  .setName("listfeed")
  .setDescription("List all feeds in channel")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Add 2 members to check against")
      .setRequired(false)
  );

export const refreshCommand = new SlashCommandBuilder()
  .setName("refreshfeed")
  .setDescription(
    "Say f*ck you to the bot, and refresh the rss feed yourself."
  );

export async function deployCommands() {
  const discordCommands = [
    addCommand,
    removeCommand,
    listCommand,
    refreshCommand,
  ];

  // Get the rest client
  const rest = new REST({ version: "10" }).setToken(
    process.env.BOT_TOKEN
  );

  try {
    // Log state
    console.log("Deploying commands...");

    // Deploy commands
    await rest.put(Routes.applicationCommands("1131294924214644839"), {
      body: discordCommands,
    });

    // Log state
    console.log("Commands deployed!");
  } catch (error) {
    // Log state
    console.log("Failed to deploy commands!\n", error);
  }

  // Exit the process
  process.exit();
}

void deployCommands();
