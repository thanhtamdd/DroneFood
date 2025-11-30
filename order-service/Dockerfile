FROM node:20-alpine

WORKDIR /app

# Copy package và cài dependencies
COPY package*.json ./
RUN npm install

# Copy TS source + tsconfig
COPY tsconfig.json ./
COPY src ./src

# Cài typescript và types
RUN npm install --save-dev typescript @types/node @types/express @types/mssql @types/dotenv @types/amqplib

# Build TS ra JS
RUN npx tsc

# Set default environment variables
ENV ORDER_PORT=3003
ENV DB_PORT=1433

# Chạy service
CMD ["node", "dist/index.js"]
