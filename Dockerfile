# syntax=docker/dockerfile:1.7
FROM node:20 AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
# Public, client-inlined values only. NEXT_PUBLIC_* are compiled into the
# client bundle at build time, so they are safe to pass as plain build args.
# This list is exactly the NEXT_PUBLIC_* vars referenced in src/.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_COUPON_IDENTITY_MODE
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_COUPON_IDENTITY_MODE=$NEXT_PUBLIC_COUPON_IDENTITY_MODE

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

# NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is a private secret. It is required at
# build time (Next.js encrypts Server Action closures with it) but must NOT be
# baked into any ARG/ENV/layer. It is provided via a BuildKit secret and only
# exported into this single RUN's environment. The same value is supplied again
# at runtime (env_file) so encrypt/decrypt stays stable across build & runtime.
RUN --mount=type=secret,id=next_actions_key \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_actions_key 2>/dev/null || true)" \
    npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# No secrets baked here. NEXT_SERVER_ACTIONS_ENCRYPTION_KEY and all other
# private values are injected at runtime via env_file / environment.
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

CMD ["npm", "run", "start"]
