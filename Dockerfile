# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies needed for the build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the compiled output from the build stage
COPY --from=builder /app/dist ./dist

# Run as a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# The HTTP server listens on PORT (default 3000)
EXPOSE 3000

CMD ["node", "dist/httpServer.js"]
