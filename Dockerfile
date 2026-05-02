# Use Node.js 20 Alpine as a lightweight base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies using the updated flag to avoid the warning
RUN npm ci --omit=dev

# Copy the rest of the application files
COPY . .

# Expose the default port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
