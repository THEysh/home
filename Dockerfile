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

ENV COS_STYLE_DISPLAY="imageMogr2/auto-orient/thumbnail/1920x>/format/jpg/interlace/1"
ENV COS_STYLE_THUMB="imageMogr2/auto-orient/thumbnail/360x>/format/jpg/interlace/1"

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server.js ./
COPY emoji_data.json ./
COPY links.example.json ./
COPY background.example.json ./
COPY images.example.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p uploads/originals uploads/display uploads/thumbs \
    && chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chown -R appuser:nodejs /app

USER appuser

EXPOSE 39421

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
