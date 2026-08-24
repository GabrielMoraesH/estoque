FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node scripts/migrate.js ./scripts/migrate.js

USER node
EXPOSE 5000

CMD ["node", "src/server.js"]

FROM dependencies AS development

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
