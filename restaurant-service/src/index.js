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
// Lấy menu theo restaurantId
app.get("/restaurants/:id/menu", async (req, res) => {
    try {
        const restaurantId = req.params.id;
        const result = await pool.request()
            .input("id", restaurantId)
            .query("SELECT * FROM MenuItems WHERE RestaurantId = @id");
        res.json(result.recordset);
    }
    catch (err) {
        res.status(500).json({ error: err });
    }
});
app.listen(parseInt(process.env.RESTAURANT_PORT), async () => {
    await pool.connect();
    console.log(`Restaurant Service running on port ${process.env.RESTAURANT_PORT}`);
});
//# sourceMappingURL=index.js.map