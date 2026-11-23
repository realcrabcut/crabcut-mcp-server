FROM node:20-alpine AS builder
# Pinned, not @latest: a newer pnpm can change install behaviour (or raise its
# Node requirement) and break an unchanged build. Same pin as the other services.
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/http.js"]
