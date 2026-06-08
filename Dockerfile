FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy" npx prisma generate

COPY server ./server/
COPY tsconfig.server.json ./

RUN npm run build:server

EXPOSE 3000

CMD npx prisma migrate deploy && node dist/server/index.js
