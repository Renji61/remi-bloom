# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Build-time dependencies that Alpine may need for native modules
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json next.config.ts drizzle.config.ts postcss.config.js ./
COPY public ./public
COPY src ./src

# The build does not need a real database connection;
# drizzle.config.ts is only used by drizzle-kit at dev time, not by next build
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

LABEL org.opencontainers.image.title="REMI Bloom" \
      org.opencontainers.image.description="Local-first plant management PWA" \
      org.opencontainers.image.source="https://github.com/renji61/remi-bloom" \
      org.opencontainers.image.licenses="UNLICENSED"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=deps /app/node_modules ./node_modules
# Ensure `postgres` runtime dependency is present (may be missed by Next.js standalone trace)
RUN if [ ! -d "node_modules/postgres" ]; then \
      npm install postgres@^3.4.0 --no-save 2>&1; \
    fi
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY scripts/start-server.mjs ./scripts/start-server.mjs

USER nextjs

EXPOSE 4131

ENV PORT=4131
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const http=require('http');const req=http.get('http://127.0.0.1:4131',res=>process.exit(res.statusCode<500?0:1));req.on('error',()=>process.exit(1));req.setTimeout(4000,()=>{req.destroy();process.exit(1);});"

CMD ["node", "scripts/start-server.mjs"]
