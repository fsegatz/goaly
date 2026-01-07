# Dockerfile for Goaly - Node.js Server (handling Auth + Static Files)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Build arguments for Google API credentials (kept for consistency, though server reads env vars)
ARG GOOGLE_API_KEY=""
ARG GOOGLE_CLIENT_ID=""

# IMPORTANT: For production, set REFRESH_TOKEN_KEY environment variable for token persistence.
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Example: docker run -e REFRESH_TOKEN_KEY=your64characterhexkey ...

# Copy all files
COPY . .

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "src/server/server.js"]
