FROM node:20-alpine

WORKDIR /app

# Copy package.json và cài dependencies
COPY package*.json ./
RUN npm install

# Copy TS source + tsconfig
COPY tsconfig.json ./
COPY src ./src

# Cài typescript và types cho dev
RUN npm install --save-dev typescript @types/node @types/amqplib @types/dotenv

# Build TS ra JS
RUN npx tsc

# Set default RabbitMQ URL
ENV RABBITMQ_URL=amqp://rabbitmq

# Chạy service
CMD ["node", "dist/index.js"]
