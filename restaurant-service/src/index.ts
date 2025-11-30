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

// ================== Restaurants CRUD ==================
app.get("/restaurants", async (req: Request, res: Response) => {
    try {
        const result = await pool.request().query("SELECT TOP 10 * FROM Restaurants");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.post("/restaurants", async (req: Request, res: Response) => {
    const { name, address, phone } = req.body;
    try {
        const result = await pool.request()
            .input("name", sql.NVarChar, name)
            .input("address", sql.NVarChar, address)
            .input("phone", sql.NVarChar, phone)
            .query(`
                INSERT INTO Restaurants (Name, Address, Phone) 
                VALUES (@name, @address, @phone); 
                SELECT SCOPE_IDENTITY() AS Id;
            `);
        const restaurantId = result.recordset[0].Id;
        res.json({ restaurantId, name, address, phone });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.put("/restaurants/:id", async (req: Request, res: Response) => {
    const restaurantId = req.params.id;
    const { name, address, phone } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, restaurantId)
            .input("name", sql.NVarChar, name)
            .input("address", sql.NVarChar, address)
            .input("phone", sql.NVarChar, phone)
            .query(`
                UPDATE Restaurants SET Name = @name, Address = @address, Phone = @phone 
                WHERE Id = @id
            `);
        res.json({ restaurantId, name, address, phone });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.delete("/restaurants/:id", async (req: Request, res: Response) => {
    const restaurantId = req.params.id;
    try {
        await pool.request()
            .input("id", sql.Int, restaurantId)
            .query("DELETE FROM Restaurants WHERE Id = @id");
        res.json({ message: `Restaurant ${restaurantId} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// ================== Dishes CRUD ==================
app.get("/restaurants/:id/dishes", async (req: Request, res: Response) => {
    const restaurantId = req.params.id;
    try {
        const result = await pool.request()
            .input("restaurantId", sql.Int, restaurantId)
            .query("SELECT * FROM Dishes WHERE RestaurantId = @restaurantId");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.post("/restaurants/:id/dishes", async (req: Request, res: Response) => {
    const restaurantId = req.params.id;
    const { name, description, price } = req.body;
    try {
        const result = await pool.request()
            .input("restaurantId", sql.Int, restaurantId)
            .input("name", sql.NVarChar, name)
            .input("description", sql.NVarChar, description)
            .input("price", sql.Decimal(10, 2), price)
            .query(`
                INSERT INTO Dishes (RestaurantId, Name, Description, Price) 
                VALUES (@restaurantId, @name, @description, @price); 
                SELECT SCOPE_IDENTITY() AS Id;
            `);
        const dishId = result.recordset[0].Id;
        res.json({ dishId, restaurantId, name, description, price });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.put("/restaurants/:restaurantId/dishes/:dishId", async (req: Request, res: Response) => {
    const { restaurantId, dishId } = req.params;
    const { name, description, price } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, dishId)
            .input("restaurantId", sql.Int, restaurantId)
            .input("name", sql.NVarChar, name)
            .input("description", sql.NVarChar, description)
            .input("price", sql.Decimal(10, 2), price)
            .query(`
                UPDATE Dishes 
                SET Name = @name, Description = @description, Price = @price 
                WHERE Id = @id AND RestaurantId = @restaurantId
            `);
        res.json({ dishId, restaurantId, name, description, price });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.delete("/restaurants/:restaurantId/dishes/:dishId", async (req: Request, res: Response) => {
    const { restaurantId, dishId } = req.params;
    try {
        await pool.request()
            .input("id", sql.Int, dishId)
            .input("restaurantId", sql.Int, restaurantId)
            .query("DELETE FROM Dishes WHERE Id = @id AND RestaurantId = @restaurantId");
        res.json({ message: `Dish ${dishId} deleted from restaurant ${restaurantId}.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.listen(PORT, async () => {
    await connectWithRetry(pool);
    console.log(`Restaurant Service running on port ${PORT}`);
});
