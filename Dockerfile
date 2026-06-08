FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy" npx prisma generate

COPY server ./server/

EXPOSE 3000

CMD npx prisma migrate deploy && npx tsx server/index.ts
