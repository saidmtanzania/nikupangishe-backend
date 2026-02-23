FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Dependencies stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /tmp/prod_modules
RUN npm ci

# Build stage
FROM dependencies AS build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init

COPY --from=build /app/dist ./dist
COPY --from=build /tmp/prod_modules ./node_modules
COPY package.json ./

RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]