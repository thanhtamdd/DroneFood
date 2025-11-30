FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

# Cài tất cả types cần thiết
RUN npm install --save-dev typescript \
    @types/node \
    @types/amqplib \
    @types/dotenv \
    @types/express \
    @types/mssql

# Biên dịch TypeScript
RUN npx tsc

ENV RABBITMQ_URL=amqp://rabbitmq

CMD ["node", "dist/index.js"]
