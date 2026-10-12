# Builds either NestJS service: docker build --build-arg APP=ingest-service backend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG APP
RUN npx nest build ${APP}

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
ARG APP
ENV APP=${APP}
COPY --from=build /app/dist ./dist
COPY proto ./proto
USER node
CMD ["sh", "-c", "node dist/apps/${APP}/apps/${APP}/src/main.js"]
