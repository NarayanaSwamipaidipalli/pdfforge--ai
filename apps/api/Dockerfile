# Multi-stage production build for NestJS API
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN addgroup -S pdfforge && adduser -S pdfforge -G pdfforge

ENV NODE_ENV=production
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN chown -R pdfforge:pdfforge /app

EXPOSE 4000
USER pdfforge
CMD ["node", "dist/main"]
