import express from "express";
import sql from "mssql";
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
app.post("/payments/charge", async (req, res) => {
    const { orderId, amount } = req.body;
    try {
        await pool.request()
            .input("orderId", orderId)
            .input("amount", amount)
            .query("INSERT INTO Payments (OrderId, Amount, Status) VALUES (@orderId, @amount, 'Completed')");
        res.json({ status: "Paid" });
    }
    catch (err) {
        res.status(500).json({ error: err });
    }
});
app.listen(parseInt(process.env.PAYMENT_PORT), async () => {
    await pool.connect();
    console.log(`Payment Service running on port ${process.env.PAYMENT_PORT}`);
});
//# sourceMappingURL=index.js.map