# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install gh CLI for GitHub operations
RUN apk add --no-cache github-cli

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy data directory structure
COPY --from=builder /app/data ./data

# Create necessary directories
RUN mkdir -p data/tasks data/projects data/reports data/plans

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/index.js"]
