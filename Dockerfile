# Stage 1: Build Frontend (Next.js)
FROM node:20-alpine AS builder

WORKDIR /app/client
# Copy client package files and install dependencies
COPY client/package*.json ./
RUN npm ci

# Copy client source code and build it
COPY client/ ./
RUN npm run build

# Stage 2: Production Backend
FROM node:20-alpine

WORKDIR /app

# Install build tools required for compiling better-sqlite3 on Alpine Linux
RUN apk add --no-cache python3 make g++ sqlite-dev

# Copy backend package files
COPY package*.json ./
# Install backend dependencies
RUN npm ci --omit=dev

# Copy backend source code
COPY . .

# Remove the raw client folder from the final image to save space
RUN rm -rf client

# Copy the compiled Next.js static files to the expected directory
COPY --from=builder /app/client/out ./client/out

# Expose port (Railway will set the PORT env variable automatically)
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
