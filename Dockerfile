FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

# Dependencies stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --omit=dev && cp -R node_modules /tmp/prod_modules
RUN npm ci

# Build stage
FROM dependencies AS build
COPY . .
RUN npm run build
RUN mkdir -p uploads

# Production stage
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS production
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=65532:65532 /app/dist ./dist
COPY --from=build --chown=65532:65532 /tmp/prod_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/uploads ./uploads

EXPOSE 3000
CMD ["dist/database/start-production.js"]