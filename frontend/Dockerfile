# =============================================================================
# Stage 1: Base with dependencies
# =============================================================================
FROM node:20-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# =============================================================================
# Stage 2: Development (with hot reload)
# =============================================================================
FROM base AS development

# Copy source files
COPY . .

# Expose Vite dev server port
EXPOSE 3000

# Run Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# =============================================================================
# Stage 3: Builder (for production)
# =============================================================================
FROM base AS builder

# Copy source files
COPY . .

# Build the app
RUN npm run build

# =============================================================================
# Stage 4: Production (nginx)
# =============================================================================
FROM nginx:alpine AS production

# Copy nginx configs (SSL and non-SSL)
COPY nginx.conf /etc/nginx/nginx-ssl.conf
COPY nginx-http-only.conf /etc/nginx/nginx-http-only.conf

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose ports (HTTP and HTTPS)
EXPOSE 3000 3443

ENTRYPOINT ["/docker-entrypoint.sh"]
