// routes/auth.js — Login y Registro para MindPath
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { verificarToken } = require("../middleware/auth");

// ─────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: "Email y contraseña son requeridos.",
      });
    }

    const [rows] = await pool.query(
      "SELECT * FROM usuarios WHERE email = ? AND activo = TRUE LIMIT 1",
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        mensaje: "Credenciales incorrectas. Verifica tu email y contraseña.",
      });
    }

    const usuario = rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({
        ok: false,
        mensaje: "Credenciales incorrectas. Verifica tu email y contraseña.",
      });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        matricula: usuario.matricula,
        avatar_color: usuario.avatar_color,
        puntos: usuario.puntos,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    return res.json({
      ok: true,
      mensaje: `¡Bienvenido/a, ${usuario.nombre}!`,
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        matricula: usuario.matricula,
        avatar_color: usuario.avatar_color,
        puntos: usuario.puntos,
      },
    });
  } catch (err) {
    console.error("Error en /login:", err);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor." });
  }
});

// ─────────────────────────────────────
//  POST /api/auth/registro
// ─────────────────────────────────────
router.post("/registro", async (req, res) => {
  try {
    const { nombre, email, password, rol = "alumno", matricula } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: "Nombre, email y contraseña son obligatorios.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        mensaje: "La contraseña debe tener al menos 6 caracteres.",
      });
    }

    const [existe] = await pool.query(
      "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
      [email.toLowerCase().trim()]
    );

    if (existe.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: "Ya existe una cuenta con ese email.",
      });
    }

    const colores = ["#6C63FF", "#FF6B6B", "#4ECDC4", "#FFD93D", "#FF6B9D", "#43D9AD"];
    const colorAleatorio = colores[Math.floor(Math.random() * colores.length)];

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, password, rol, matricula, avatar_color)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nombre.trim(),
        email.toLowerCase().trim(),
        hash,
        rol,
        matricula || null,
        colorAleatorio,
      ]
    );

    return res.status(201).json({
      ok: true,
      mensaje: "Cuenta creada exitosamente. ¡Ya puedes iniciar sesión!",
      id: result.insertId,
    });
  } catch (err) {
    console.error("Error en /registro:", err);
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor." });
  }
});

// ─────────────────────────────────────
//  GET /api/auth/me — Perfil actual
// ─────────────────────────────────────
router.get("/me", verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, nombre, email, rol, matricula, avatar_color, puntos, creado_en FROM usuarios WHERE id = ? LIMIT 1",
      [req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado." });
    }

    return res.json({ ok: true, usuario: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: "Error interno del servidor." });
  }
});

module.exports = router;
