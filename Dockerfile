# Dockerfile for Goaly - Node.js Server (handling Auth + Static Files)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Build arguments for Google API credentials (kept for consistency, though server reads env vars)
ARG GOOGLE_API_KEY=""
ARG GOOGLE_CLIENT_ID=""

# Copy all files
COPY . .

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "src/server/index.js"]
