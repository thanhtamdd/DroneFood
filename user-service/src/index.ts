import express from "express";
import type { Request, Response } from "express";
import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT!) || 3001;

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

// Lấy danh sách users
app.get("/users", async (req: Request, res: Response) => {
    try {
        const result = await pool.request().query("SELECT TOP 10 * FROM Users");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Thêm user mới
app.post("/users", async (req: Request, res: Response) => {
    const { username, email, passwordHash, role } = req.body;
    try {
        const result = await pool.request()
            .input("username", sql.NVarChar, username)
            .input("email", sql.NVarChar, email)
            .input("passwordHash", sql.NVarChar, passwordHash)
            .input("role", sql.NVarChar, role || 'Customer')
            .query(`
                INSERT INTO Users (Username, Email, PasswordHash, Role) 
                VALUES (@username, @email, @passwordHash, @role); 
                SELECT SCOPE_IDENTITY() AS Id;
            `);
        const userId = result.recordset[0].Id;
        res.json({ userId, username, email, role: role || 'Customer' });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Sửa thông tin user
app.put("/users/:id", async (req: Request, res: Response) => {
    const userId = req.params.id;
    const { username, email, passwordHash, role } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, userId)
            .input("username", sql.NVarChar, username)
            .input("email", sql.NVarChar, email)
            .input("passwordHash", sql.NVarChar, passwordHash)
            .input("role", sql.NVarChar, role)
            .query(`
                UPDATE Users 
                SET Username = @username, Email = @email, PasswordHash = @passwordHash, Role = @role
                WHERE Id = @id
            `);
        res.json({ userId, username, email, role });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Xóa user
app.delete("/users/:id", async (req: Request, res: Response) => {
    const userId = req.params.id;
    try {
        await pool.request()
            .input("id", sql.Int, userId)
            .query("DELETE FROM Users WHERE Id = @id");
        res.json({ message: `User ${userId} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.listen(PORT, async () => {
    await connectWithRetry(pool);
    console.log(`User Service running on port ${PORT}`);
});
