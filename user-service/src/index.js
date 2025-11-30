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
app.get("/users", async (req, res) => {
    try {
        const result = await pool.request().query("SELECT TOP 10 * FROM Users");
        res.json(result.recordset);
    }
    catch (err) {
        res.status(500).json({ error: err });
    }
});
app.listen(parseInt(process.env.USER_PORT), async () => {
    await pool.connect();
    console.log(`User Service running on port ${process.env.USER_PORT}`);
});
//# sourceMappingURL=index.js.map