import express from "express";
import type { Request, Response } from "express";
import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT!) || 3002;

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

// ================== Restaurants CRUD ==================

// Lấy danh sách nhà hàng
app.get("/restaurants", async (req: Request, res: Response) => {
    try {
        const result = await pool.request().query("SELECT TOP 10 * FROM Restaurants");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Thêm nhà hàng mới
app.post("/restaurants", async (req: Request, res: Response) => {
    const { name, address } = req.body;
    try {
        const result = await pool.request()
            .input("name", sql.NVarChar, name)
            .input("address", sql.NVarChar, address)
            .query("INSERT INTO Restaurants (Name, Address) VALUES (@name, @address); SELECT SCOPE_IDENTITY() AS RestaurantId;");
        const restaurantId = result.recordset[0].RestaurantId;
        res.json({ restaurantId, name, address });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Sửa nhà hàng
app.put("/restaurants/:id", async (req: Request, res: Response) => {
    const restaurantId = req.params.id;
    const { name, address } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, restaurantId)
            .input("name", sql.NVarChar, name)
            .input("address", sql.NVarChar, address)
            .query("UPDATE Restaurants SET Name = @name, Address = @address WHERE RestaurantId = @id");
        res.json({ restaurantId, name, address });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Xóa nhà hàng
app.delete("/restaurants/:id", async (req: Request, res: Response) => {
    const restaurantId = req.params.id;
    try {
        await pool.request()
            .input("id", sql.Int, restaurantId)
            .query("DELETE FROM Restaurants WHERE RestaurantId = @id");
        res.json({ message: `Restaurant ${restaurantId} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// ================== MenuItems CRUD ==================

// Lấy menu theo restaurantId
app.get("/restaurants/:id/menu", async (req: Request, res: Response) => {
    const restaurantId = req.params.id;
    try {
        const result = await pool.request()
            .input("id", sql.Int, restaurantId)
            .query("SELECT * FROM MenuItems WHERE RestaurantId = @id");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Thêm món mới vào menu
app.post("/restaurants/:id/menu", async (req: Request, res: Response) => {
    const restaurantId = req.params.id;
    const { name, price } = req.body;
    try {
        const result = await pool.request()
            .input("restaurantId", sql.Int, restaurantId)
            .input("name", sql.NVarChar, name)
            .input("price", sql.Decimal(10, 2), price)
            .query("INSERT INTO MenuItems (RestaurantId, Name, Price) VALUES (@restaurantId, @name, @price); SELECT SCOPE_IDENTITY() AS MenuItemId;");
        const menuItemId = result.recordset[0].MenuItemId;
        res.json({ menuItemId, restaurantId, name, price });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Sửa món trong menu
app.put("/restaurants/:restaurantId/menu/:menuItemId", async (req: Request, res: Response) => {
    const { restaurantId, menuItemId } = req.params;
    const { name, price } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, menuItemId)
            .input("restaurantId", sql.Int, restaurantId)
            .input("name", sql.NVarChar, name)
            .input("price", sql.Decimal(10, 2), price)
            .query("UPDATE MenuItems SET Name = @name, Price = @price WHERE MenuItemId = @id AND RestaurantId = @restaurantId");
        res.json({ menuItemId, restaurantId, name, price });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Xóa món trong menu
app.delete("/restaurants/:restaurantId/menu/:menuItemId", async (req: Request, res: Response) => {
    const { restaurantId, menuItemId } = req.params;
    try {
        await pool.request()
            .input("id", sql.Int, menuItemId)
            .input("restaurantId", sql.Int, restaurantId)
            .query("DELETE FROM MenuItems WHERE MenuItemId = @id AND RestaurantId = @restaurantId");
        res.json({ message: `MenuItem ${menuItemId} deleted from restaurant ${restaurantId}.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.listen(PORT, async () => {
    await connectWithRetry(pool);
    console.log(`Restaurant Service running on port ${PORT}`);
});
