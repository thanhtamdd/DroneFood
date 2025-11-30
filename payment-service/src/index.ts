import express from "express";
import type { Request, Response } from "express";
import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT!) || 3004;

const pool = new sql.ConnectionPool({
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    server: process.env.DB_SERVER!,
    port: 1433,
    database: process.env.DB_NAME!,
    options: { encrypt: false, trustServerCertificate: true },
});

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

app.post("/payments/charge", async (req: Request, res: Response) => {
    const { orderId, amount } = req.body;
    try {
        await pool.request()
            .input("orderId", orderId)
            .input("amount", amount)
            .query("INSERT INTO Payments (OrderId, Amount, Status) VALUES (@orderId, @amount, 'Completed')");
        res.json({ status: "Paid" });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.listen(PORT, async () => {
    await connectWithRetry(pool);
    console.log(`Payment Service running on port ${PORT}`);
});
