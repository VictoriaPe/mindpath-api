// server.js — Backend MindPath para Render.com
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");
const { testConnection } = require("./config/db");

const app  = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────
//  CORS — Permite peticiones desde Netlify
//  Cambia el origin por tu URL real de Netlify
// ─────────────────────────────────────
app.use(cors({
  origin: [
    "https://TU-SITIO.netlify.app",   // ← reemplaza con tu URL de Netlify
    "http://localhost:3000",           // para desarrollo local
    "http://127.0.0.1:5500",          // Live Server de VS Code
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ─────────────────────────────────────
//  RUTAS DE LA API
// ─────────────────────────────────────
app.use("/api/auth",        require("./routes/auth"));
app.use("/api/dashboard",   require("./routes/dashboard"));
app.use("/api/estudiantes", require("./routes/estudiantes"));

// Health check para Render
app.get("/health", (req, res) => {
  res.json({ ok: true, mensaje: "MindPath API funcionando ✅", timestamp: new Date() });
});

// Ruta raíz informativa
app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "MindPath API",
    version: "1.0.0",
    endpoints: ["/api/auth", "/api/dashboard", "/api/estudiantes"],
  });
});

// 404 para rutas desconocidas
app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: `Ruta ${req.path} no encontrada.` });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({ ok: false, mensaje: "Error interno del servidor." });
});

// ─────────────────────────────────────
//  INICIAR
// ─────────────────────────────────────
async function iniciar() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`\n🚀 MindPath API corriendo en puerto ${PORT}`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health\n`);
  });
}

iniciar();
