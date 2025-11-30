FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm install --save-dev typescript @types/node @types/amqplib @types/dotenv

RUN npx tsc

ENV RABBITMQ_URL=amqp://rabbitmq

CMD ["node", "dist/index.js"]
