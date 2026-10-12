# BINTH.IN Production Dockerfile
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies in server
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Copy entire project (frontend, admin, database, and backend)
WORKDIR /app
COPY . .

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/server

# Start the unified backend & static server
CMD ["node", "server.js"]
