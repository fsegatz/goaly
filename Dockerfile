# Dockerfile for Goaly - Nginx Static File Server
# Now using serverless Cloud Functions for OAuth, so only static files are served
FROM nginx:alpine

# Copy static files to nginx html directory
COPY . /usr/share/nginx/html

# Create nginx config for SPA routing
RUN echo 'server { \
    listen 8080; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Gzip compression \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; \
    \
    # SPA fallback \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port (Cloud Run uses 8080)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
