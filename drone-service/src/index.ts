import express from "express";
import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT!) || 3005;

let channel: amqp.Channel;

async function connectRabbitMQ() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL!);
    channel = await conn.createChannel();
    await channel.assertQueue("dispatch_queue", { durable: true });
    channel.consume("dispatch_queue", (msg) => {
        if (msg) {
            const data = JSON.parse(msg.content.toString());
            console.log("Drone received order:", data.orderId);
            channel.ack(msg);
        }
    });
}

app.listen(PORT, async () => {
    await connectRabbitMQ();
    console.log(`Drone Service running on port ${PORT}`);
});
