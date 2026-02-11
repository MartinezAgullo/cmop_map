# ==============================================================================
# Dockerfile - CMOP Map Backend
# ==============================================================================
# Multi-stage build:
#   1. Build stage: Install dependencies
#   2. Production stage: Minimal runtime image
# ==============================================================================

FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# ==============================================================================
# Production stage
# ==============================================================================
FROM node:18-alpine

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY package*.json ./
COPY server.js ./
COPY config ./config
COPY models ./models
COPY routes ./routes
COPY public ./public
COPY scripts ./scripts
COPY .env.example ./.env

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start command
CMD ["npm", "start"]