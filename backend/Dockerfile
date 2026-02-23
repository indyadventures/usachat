FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g curl

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/db/schema.sql ./dist/db/schema.sql

EXPOSE 8080

CMD ["node", "dist/server.js"]
