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

// ================== Payments CRUD ==================

// Lấy tất cả payments, có thể filter theo orderId
app.get("/payments", async (req: Request, res: Response) => {
    const { orderId } = req.query;
    try {
        let query = "SELECT * FROM Payments";
        const request = pool.request();
        if (orderId) {
            query += " WHERE OrderId = @orderId";
            request.input("orderId", sql.Int, orderId as string);
        }
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Lấy payment theo Id
app.get("/payments/:id", async (req: Request, res: Response) => {
    const paymentId = req.params.id;
    try {
        const result = await pool.request()
            .input("id", sql.Int, paymentId)
            .query("SELECT * FROM Payments WHERE PaymentId = @id");
        res.json(result.recordset[0] || null);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Tạo payment (charge)
app.post("/payments/charge", async (req: Request, res: Response) => {
    const { orderId, amount } = req.body;
    try {
        const result = await pool.request()
            .input("orderId", sql.Int, orderId)
            .input("amount", sql.Decimal(10, 2), amount)
            .query("INSERT INTO Payments (OrderId, Amount, Status) VALUES (@orderId, @amount, 'Completed'); SELECT SCOPE_IDENTITY() AS PaymentId;");
        const paymentId = result.recordset[0].PaymentId;
        res.json({ paymentId, status: "Paid" });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Cập nhật payment
app.put("/payments/:id", async (req: Request, res: Response) => {
    const paymentId = req.params.id;
    const { amount, status } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, paymentId)
            .input("amount", sql.Decimal(10, 2), amount)
            .input("status", sql.NVarChar, status)
            .query("UPDATE Payments SET Amount = @amount, Status = @status WHERE PaymentId = @id");
        res.json({ paymentId, amount, status });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Xóa payment
app.delete("/payments/:id", async (req: Request, res: Response) => {
    const paymentId = req.params.id;
    try {
        await pool.request()
            .input("id", sql.Int, paymentId)
            .query("DELETE FROM Payments WHERE PaymentId = @id");
        res.json({ message: `Payment ${paymentId} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.listen(PORT, async () => {
    await connectWithRetry(pool);
    console.log(`Payment Service running on port ${PORT}`);
});
