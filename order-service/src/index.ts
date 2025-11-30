import express from "express";
import type { Request, Response } from "express";
import sql from "mssql";
import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT!) || 3003;

const pool = new sql.ConnectionPool({
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    server: process.env.DB_SERVER!,
    port: 1433,
    database: process.env.DB_NAME!,
    options: { encrypt: false, trustServerCertificate: true },
});

let channel: amqp.Channel;

// Kết nối RabbitMQ
async function connectRabbitMQ() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL!);
    channel = await conn.createChannel();
    await channel.assertExchange("order_events", "fanout", { durable: true });
}

// Kết nối SQL với retry
async function connectWithRetry(pool: sql.ConnectionPool, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            await pool.connect();
            console.log("✅ Connected to SQL Server");
            return;
        } catch (err) {
            console.log(`⚠️ SQL connection failed, retrying (${i + 1}/${retries})...`);
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    throw new Error("❌ Could not connect to SQL Server after retries");
}

// ================== Orders CRUD ==================

// Tạo order + publish event
app.post("/orders", async (req: Request, res: Response) => {
    const { userId, restaurantId, totalPrice } = req.body;
    try {
        const result = await pool.request()
            .input("userId", sql.Int, userId)
            .input("restaurantId", sql.Int, restaurantId)
            .input("totalPrice", sql.Decimal(10, 2), totalPrice)
            .query(`INSERT INTO Orders (UserId, RestaurantId, TotalPrice)
                    OUTPUT INSERTED.OrderId
                    VALUES (@userId, @restaurantId, @totalPrice)`);
        const orderId = result.recordset[0].OrderId;

        // Publish event cho các service khác
        channel.publish("order_events", "", Buffer.from(JSON.stringify({ orderId, userId, restaurantId, totalPrice })));

        res.json({ orderId });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Lấy tất cả orders
app.get("/orders", async (req: Request, res: Response) => {
    try {
        const result = await pool.request().query("SELECT * FROM Orders");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Lấy order theo Id
app.get("/orders/:id", async (req: Request, res: Response) => {
    const orderId = req.params.id;
    try {
        const result = await pool.request()
            .input("id", sql.Int, orderId)
            .query("SELECT * FROM Orders WHERE OrderId = @id");
        res.json(result.recordset[0] || null);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Cập nhật order
app.put("/orders/:id", async (req: Request, res: Response) => {
    const orderId = req.params.id;
    const { totalPrice } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, orderId)
            .input("totalPrice", sql.Decimal(10, 2), totalPrice)
            .query("UPDATE Orders SET TotalPrice = @totalPrice WHERE OrderId = @id");
        res.json({ orderId, totalPrice });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Xóa order
app.delete("/orders/:id", async (req: Request, res: Response) => {
    const orderId = req.params.id;
    try {
        await pool.request()
            .input("id", sql.Int, orderId)
            .query("DELETE FROM Orders WHERE OrderId = @id");
        res.json({ message: `Order ${orderId} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Start server
app.listen(PORT, async () => {
    await connectWithRetry(pool);
    await connectRabbitMQ();
    console.log(`Order Service running on port ${PORT}`);
});
