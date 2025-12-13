FROM oven/bun

WORKDIR /app

COPY package.json .
COPY bun.lock .

RUN bun install --production

# Install Open SSL
RUN apt-get update -y && apt-get install -y openssl

COPY src src
COPY tsconfig.json .

# Copy Prisma
COPY prisma ./prisma
RUN bun x prisma generate

ENV NODE_ENV=production
CMD ["bun", "src/index.ts"]

EXPOSE 3001