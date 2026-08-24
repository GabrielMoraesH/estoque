FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

COPY public ./public
COPY src ./src
RUN npm run build

# Production edge: serve the compiled React application with Caddy.
FROM caddy:2-alpine AS production

COPY --from=build /app/build /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

FROM dependencies AS development

COPY . .

ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["npm", "start"]
