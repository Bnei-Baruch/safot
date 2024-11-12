# Use an official Node.js runtime as the base image
FROM node:alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm install

# Copy the .env file for environment variables
COPY .env .env

# Copy the rest of the application code
COPY . .

# Install serve globally to run the built React app
RUN npm install -g serve

# Build the React app (dotenv variables are embedded at build time)
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Start the app using serve
CMD ["serve", "-s", "build"]
