FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 4001

CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
