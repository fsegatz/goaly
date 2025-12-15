# Dockerfile for Goaly - Static Web App
# Serves the app via nginx on Cloud Run

FROM nginx:alpine

# Build arguments for Google API credentials
ARG GOOGLE_API_KEY=""
ARG GOOGLE_CLIENT_ID=""

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy static files
COPY index.html /usr/share/nginx/html/
COPY styles/ /usr/share/nginx/html/styles/
COPY src/ /usr/share/nginx/html/src/
COPY docs/ /usr/share/nginx/html/docs/

# Create config.local.js with injected credentials
RUN echo "window.GOOGLE_API_KEY = \"${GOOGLE_API_KEY}\";" > /usr/share/nginx/html/config.local.js && \
    echo "window.GOOGLE_CLIENT_ID = \"${GOOGLE_CLIENT_ID}\";" >> /usr/share/nginx/html/config.local.js

# Cloud Run uses PORT environment variable
ENV PORT=8080
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
