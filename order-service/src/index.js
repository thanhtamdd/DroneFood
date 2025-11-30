import express from "express";
import sql from "mssql";
import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();
const app = express();
app.use(express.json());
const pool = new sql.ConnectionPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
});
let channel;
async function connectRabbitMQ() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await conn.createChannel();
    await channel.assertExchange("order_events", "fanout", { durable: true });
}
app.post("/orders", async (req, res) => {
    const { userId, restaurantId, totalPrice } = req.body;
    try {
        const result = await pool.request()
            .input("userId", userId)
            .input("restaurantId", restaurantId)
            .input("totalPrice", totalPrice)
            .query(`INSERT INTO Orders (UserId, RestaurantId, TotalPrice)
                    OUTPUT INSERTED.OrderId
                    VALUES (@userId, @restaurantId, @totalPrice)`);
        const orderId = result.recordset[0].OrderId;
        // Publish event
        channel.publish("order_events", "", Buffer.from(JSON.stringify({ orderId, userId, restaurantId })));
        res.json({ orderId });
    }
    catch (err) {
        res.status(500).json({ error: err });
    }
});
app.listen(parseInt(process.env.ORDER_PORT), async () => {
    await pool.connect();
    await connectRabbitMQ();
    console.log(`Order Service running on port ${process.env.ORDER_PORT}`);
});
//# sourceMappingURL=index.js.map