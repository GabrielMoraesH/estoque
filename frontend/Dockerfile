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

# Static artifact only. QG-7H will add the Caddy runtime and edge configuration.
FROM scratch AS production

COPY --from=build /app/build /build

FROM dependencies AS development

COPY . .

ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["npm", "start"]
