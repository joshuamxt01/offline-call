# Nexa backend — runs via tsx (no build step needed).
FROM node:20-alpine AS base
WORKDIR /app

# Workspace manifests first (better layer caching)
COPY package.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN npm install --omit=dev --workspace @nexa/backend --workspace @nexa/shared || npm install

# Source
COPY shared ./shared
COPY backend ./backend
COPY database ./database

ENV NODE_ENV=production
EXPOSE 4000
WORKDIR /app/backend
CMD ["npm", "run", "start"]
