import express from "express";
import sql from "mssql";
import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT!) || 3005;

const pool = new sql.ConnectionPool({
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT!) || 1433,
    database: process.env.DB_NAME!,
    options: { encrypt: false, trustServerCertificate: true },
});

let channel: amqp.Channel;

// Kết nối RabbitMQ
async function connectRabbitMQ() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL!);
    channel = await conn.createChannel();
    await channel.assertQueue("dispatch_queue", { durable: true });
    channel.consume("dispatch_queue", (msg) => {
        if (msg) {
            const data = JSON.parse(msg.content.toString());
            console.log("Drone received order:", data.orderId);
            channel.ack(msg);
        }
    });
}

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

// ================== Drones CRUD ==================
app.get("/drones", async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM Drones");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.post("/drones", async (req, res) => {
    const { model, batteryLevel, status } = req.body;
    try {
        const result = await pool.request()
            .input("model", sql.NVarChar, model)
            .input("batteryLevel", sql.Int, batteryLevel)
            .input("status", sql.NVarChar, status || "Available")
            .query(`
                INSERT INTO Drones (Model, BatteryLevel, Status)
                OUTPUT INSERTED.Id
                VALUES (@model, @batteryLevel, @status)
            `);
        const droneId = result.recordset[0].Id;
        res.json({ droneId, model, batteryLevel, status: status || "Available" });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.put("/drones/:id", async (req, res) => {
    const droneId = req.params.id;
    const { model, batteryLevel, status } = req.body;
    try {
        await pool.request()
            .input("id", sql.Int, droneId)
            .input("model", sql.NVarChar, model)
            .input("batteryLevel", sql.Int, batteryLevel)
            .input("status", sql.NVarChar, status)
            .query(`
                UPDATE Drones
                SET Model = @model, BatteryLevel = @batteryLevel, Status = @status
                WHERE Id = @id
            `);
        res.json({ droneId, model, batteryLevel, status });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.delete("/drones/:id", async (req, res) => {
    const droneId = req.params.id;
    try {
        await pool.request()
            .input("id", sql.Int, droneId)
            .query("DELETE FROM Drones WHERE Id = @id");
        res.json({ message: `Drone ${droneId} deleted.` });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// ================== DroneLocations ==================
app.post("/drones/:id/location", async (req, res) => {
    const droneId = req.params.id;
    const { latitude, longitude } = req.body;
    try {
        await pool.request()
            .input("droneId", sql.Int, droneId)
            .input("latitude", sql.Decimal(9, 6), latitude)
            .input("longitude", sql.Decimal(9, 6), longitude)
            .query(`
                INSERT INTO DroneLocations (DroneId, Latitude, Longitude)
                VALUES (@droneId, @latitude, @longitude)
            `);
        res.json({ droneId, latitude, longitude, updatedAt: new Date() });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.get("/drones/:id/location", async (req, res) => {
    const droneId = req.params.id;
    try {
        const result = await pool.request()
            .input("droneId", sql.Int, droneId)
            .query("SELECT TOP 1 * FROM DroneLocations WHERE DroneId = @droneId ORDER BY UpdatedAt DESC");
        res.json(result.recordset[0] || null);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

// Start server
app.listen(PORT, async () => {
    await connectWithRetry(pool);
    await connectRabbitMQ();
    console.log(`Drone Service running on port ${PORT}`);
});
