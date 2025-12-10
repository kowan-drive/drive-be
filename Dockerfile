# Use a smaller base image if possible
FROM oven/bun:canary-slim AS builder

WORKDIR /app

# Only copy the files necessary to install dependencies
COPY package.json tsconfig.json ./

# Copy bun.lock separately
COPY bun.lock ./

ENV NODE_ENV=production

# Install dependencies
RUN bun install --frozen-lockfile

# Install Open SSL
RUN apt-get update -y && apt-get install -y openssl

# Copy only what's needed to build
COPY prisma ./prisma
RUN bun x prisma generate

# Copy the rest of your application
COPY . .

# --- Optional: Create a smaller final image ---
FROM oven/bun:canary-slim

WORKDIR /app

# Copy from builder stage
COPY --from=builder /app /app

# Expose port
EXPOSE 3001

# Run the app
CMD ["bun", "run", "src/index.ts"]