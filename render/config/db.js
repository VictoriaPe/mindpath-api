// config/db.js — Conexión MySQL para MindPath
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "mindpath_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+00:00",
});

// Verificar conexión al iniciar
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log("✅ Conectado a MySQL — MindPath DB");
    conn.release();
  } catch (err) {
    console.error("❌ Error al conectar a MySQL:", err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
