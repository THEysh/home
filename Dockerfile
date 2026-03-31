FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS production-deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup -S nodejs && adduser -S appuser -G nodejs

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server.js ./
COPY emoji_data.json ./
COPY links.example.json ./
COPY background.example.json ./

RUN mkdir -p uploads/originals uploads/display uploads/thumbs \
    && chown -R appuser:nodejs /app

USER appuser

EXPOSE 39421

CMD ["node", "server.js"]
