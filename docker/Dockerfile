# Build stage
FROM node:25-alpine3.23 AS builder

# Install necessary build tools and compatibility layers
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY src/package.json ./src/

# Install dependencies
RUN pnpm install --frozen-lockfile=false

# Copy source
COPY . .

# Build the project
RUN pnpm run build

# Runtime stage
FROM node:25-alpine3.23 AS runner

WORKDIR /app

# The official node image already has a 'node' user with UID/GID 1000.
# We'll just ensure the directories exist and have the correct ownership.

# Create necessary directories and set ownership
RUN mkdir -p dist data && \
    chown -R node:node /app

# Install a minimal static file server globally
RUN npm install -g serve

# Copy built assets from builder stage
COPY --from=builder --chown=node:node /app/src/dist ./dist
COPY --from=builder --chown=node:node /app/data ./data

# Switch to the rootless user (node user has UID 1000, GID 1000)
USER 1000:1000

# Security and environment configuration
# No-new-privileges is set at runtime via compose or docker run
ENV NODE_ENV=production \
    PORT=3000

# Expose the port the app runs on
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the server
CMD ["serve", "-s", "dist", "-l", "3000"]
