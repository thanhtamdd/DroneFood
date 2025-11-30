import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();
async function main() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertExchange("order_events", "fanout", { durable: true });
    const q = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(q.queue, "order_events", "");
    channel.consume(q.queue, (msg) => {
        if (msg) {
            const data = JSON.parse(msg.content.toString());
            console.log("Notification: Order event received", data.orderId);
            channel.ack(msg);
        }
    });
}
main();
//# sourceMappingURL=index.js.map