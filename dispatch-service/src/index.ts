import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL!);
    const channel = await conn.createChannel();
    await channel.assertExchange("order_events", "fanout", { durable: true });
    await channel.assertQueue("dispatch_queue", { durable: true });
    await channel.bindQueue("dispatch_queue", "order_events", "");

    console.log("Dispatch Service listening for orders...");
}

main();
