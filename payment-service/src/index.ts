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
    port: parseInt(process.env.DB_PORT!) || 1433,
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

app.get("/payments/:id", async (req: Request, res: Response) => {
    const paymentId = req.params.id;
    try {
        const result = await pool.request()
            .input("id", sql.Int, paymentId)
            .query("SELECT * FROM Payments WHERE Id = @id");
        res.json(result.recordset[0] || null);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.post("/payments/charge", async (req: Request, res: Response) => {
    const { orderId, amount, paymentMethod } = req.body;
    try {
        const result = await pool.request()
            .input("orderId", sql.Int, orderId)
            .input("amount", sql.Decimal(10, 2), amount)
            .input("paymentMethod", sql.NVarChar, paymentMethod || "Unknown")
            .query(`
                INSERT INTO Payments (OrderId, Amount, Status, PaymentMethod, PaidAt) 
                VALUES (@orderId, @amount, 'Completed', @paymentMethod, GETDATE()); 
                SELECT SCOPE_IDENTITY() AS Id;
            `);
        const paymentId = result.recordset[0].Id;
        res.json({ paymentId, orderId, amount, status: "Completed", paymentMethod });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.put("/payments/:id", async (req: Request, res: Response) => {
    const paymentId = req.params.id;
    const { amount, status, paymentMethod } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, paymentId)
            .input("amount", sql.Decimal(10, 2), amount)
            .input("status", sql.NVarChar, status)
            .input("paymentMethod", sql.NVarChar, paymentMethod)
            .query(`
                UPDATE Payments 
                SET Amount = @amount, Status = @status, PaymentMethod = @paymentMethod
                WHERE Id = @id
            `);
        res.json({ paymentId, amount, status, paymentMethod });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.delete("/payments/:id", async (req: Request, res: Response) => {
    const paymentId = req.params.id;
    try {
        await pool.request()
            .input("id", sql.Int, paymentId)
            .query("DELETE FROM Payments WHERE Id = @id");
        res.json({ message: `Payment ${paymentId} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.listen(PORT, async () => {
    await connectWithRetry(pool);
    console.log(`Payment Service running on port ${PORT}`);
});
