# Multi-stage production build for Next.js 15
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat

WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci \
    --no-audit \
    --no-fund \
    --prefer-offline \
    --fetch-retries=1 \
    --fetch-timeout=60000 \
    --loglevel=http
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S pdfforge && adduser -S pdfforge -G pdfforge
COPY --from=builder --chown=pdfforge:pdfforge /app/public ./public
COPY --from=builder --chown=pdfforge:pdfforge /app/.next/standalone ./
COPY --from=builder --chown=pdfforge:pdfforge /app/.next/static ./.next/static
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000
USER pdfforge
CMD ["node", "server.js"]
