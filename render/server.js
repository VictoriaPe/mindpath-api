// server.js — Backend MindPath para Render.com
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");
const { testConnection } = require("./config/db");

const app  = express();
const PORT = process.env.PORT || 3000;

// CORS abierto para todos los orígenes
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/api/auth",        require("./routes/auth"));
app.use("/api/dashboard",   require("./routes/dashboard"));
app.use("/api/estudiantes", require("./routes/estudiantes"));

app.get("/health", (req, res) => {
  res.json({ ok: true, mensaje: "MindPath API funcionando ✅", timestamp: new Date() });
});

app.get("/", (req, res) => {
  res.json({ ok: true, app: "MindPath API", version: "1.0.0" });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: `Ruta ${req.path} no encontrada.` });
});

app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({ ok: false, mensaje: "Error interno del servidor." });
});

async function iniciar() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`\n🚀 MindPath API corriendo en puerto ${PORT}`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health\n`);
  });
}

iniciar();
