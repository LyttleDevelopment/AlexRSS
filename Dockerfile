# Use an official Node.js runtime as a parent image
FROM node:20.17.0

# Set the working directory in the container
WORKDIR /usr/src/bot

# Copy the current directory contents into the container at /community-v3/Client
COPY . .

# Install dependencies using npm ci
RUN npm ci

# Build the application
RUN npm run docker:setup

# Command to run your application
CMD ["npm", "start"]
