import sql from "mssql";
import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();

const PORT = parseInt(process.env.PORT!) || 3006;

const pool = new sql.ConnectionPool({
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT!) || 1433,
    database: process.env.DB_NAME!,
    options: { encrypt: false, trustServerCertificate: true },
});

let channel: amqp.Channel;

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

// Kết nối RabbitMQ
async function connectRabbitMQ() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL!);
    channel = await conn.createChannel();
    await channel.assertExchange("order_events", "fanout", { durable: true });
    await channel.assertQueue("dispatch_queue", { durable: true });
    await channel.bindQueue("dispatch_queue", "order_events", "");

    channel.consume("dispatch_queue", async (msg) => {
        if (msg) {
            const orderData = JSON.parse(msg.content.toString());
            console.log("Dispatch Service received order:", orderData.orderId);

            // Tạo Dispatch mới (giả định DroneId = 1, có thể logic khác)
            try {
                const result = await pool.request()
                    .input("orderId", sql.Int, orderData.orderId)
                    .input("droneId", sql.Int, 1) // tạm thời gán DroneId = 1
                    .query(`
                        INSERT INTO Dispatches (OrderId, DroneId, Status)
                        OUTPUT INSERTED.Id
                        VALUES (@orderId, @droneId, 'Assigned')
                    `);
                const dispatchId = result.recordset[0].Id;
                console.log(`Created Dispatch ${dispatchId} for Order ${orderData.orderId}`);
            } catch (err) {
                console.error("Error creating dispatch:", err);
            }

            channel.ack(msg);
        }
    });
}

// CRUD cơ bản cho Dispatches
import express from "express";
import type { Request, Response } from "express";

const app = express();
app.use(express.json());

// Lấy tất cả dispatches
app.get("/dispatches", async (req: Request, res: Response) => {
    try {
        const result = await pool.request().query("SELECT * FROM Dispatches");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Lấy dispatch theo Id
app.get("/dispatches/:id", async (req: Request, res: Response) => {
    const dispatchId = req.params.id;
    try {
        const result = await pool.request()
            .input("id", sql.Int, dispatchId)
            .query("SELECT * FROM Dispatches WHERE Id = @id");
        res.json(result.recordset[0] || null);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Cập nhật dispatch (ví dụ đổi status)
app.put("/dispatches/:id", async (req: Request, res: Response) => {
    const dispatchId = req.params.id;
    const { status, droneId } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, dispatchId)
            .input("status", sql.NVarChar, status)
            .input("droneId", sql.Int, droneId)
            .query(`
                UPDATE Dispatches
                SET Status = @status, DroneId = @droneId
                WHERE Id = @id
            `);
        res.json({ dispatchId, status, droneId });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Xóa dispatch
app.delete("/dispatches/:id", async (req: Request, res: Response) => {
    const dispatchId = req.params.id;
    try {
        await pool.request()
            .input("id", sql.Int, dispatchId)
            .query("DELETE FROM Dispatches WHERE Id = @id");
        res.json({ message: `Dispatch ${dispatchId} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Start server
app.listen(PORT, async () => {
    await connectWithRetry(pool);
    await connectRabbitMQ();
    console.log(`Dispatch Service running on port ${PORT}`);
});
