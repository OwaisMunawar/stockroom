FROM node:22-bookworm-slim
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY shared ./shared
COPY server ./server
ENV PORT=8057 STOCKROOM_BIND=0.0.0.0 STOCKROOM_DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8057
CMD ["node_modules/.bin/tsx", "server/main.ts"]
