// routes/estudiantes.js — CRUD de Estudiantes para MindPath
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { verificarToken, soloAdmin, soloDocente } = require("../middleware/auth");

router.use(verificarToken);

// GET /api/estudiantes — Listar todos
router.get("/", soloDocente, async (req, res) => {
  try {
    const { pagina = 1, limite = 10, buscar = "" } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);

    const busqueda = `%${buscar}%`;

    const [rows] = await pool.query(
      `SELECT id, nombre, email, matricula, avatar_color, puntos, activo, creado_en
       FROM usuarios
       WHERE rol = 'alumno'
         AND (nombre LIKE ? OR email LIKE ? OR matricula LIKE ?)
       ORDER BY puntos DESC
       LIMIT ? OFFSET ?`,
      [busqueda, busqueda, busqueda, parseInt(limite), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM usuarios
       WHERE rol = 'alumno' AND (nombre LIKE ? OR email LIKE ? OR matricula LIKE ?)`,
      [busqueda, busqueda, busqueda]
    );

    return res.json({
      ok: true,
      estudiantes: rows,
      paginacion: {
        total,
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        paginas: Math.ceil(total / parseInt(limite)),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: "Error al obtener estudiantes." });
  }
});

// GET /api/estudiantes/:id — Detalle
router.get("/:id", soloDocente, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.matricula, u.avatar_color, u.puntos, u.activo,
              u.creado_en,
              COUNT(DISTINCT i.curso_id) AS cursos_inscritos,
              COUNT(DISTINCT e.id) AS entregas_realizadas
       FROM usuarios u
       LEFT JOIN inscripciones i ON i.alumno_id = u.id
       LEFT JOIN entregas e ON e.alumno_id = u.id
       WHERE u.id = ? AND u.rol = 'alumno'
       GROUP BY u.id`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: "Estudiante no encontrado." });
    }

    return res.json({ ok: true, estudiante: rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: "Error al obtener estudiante." });
  }
});

// POST /api/estudiantes — Crear
router.post("/", soloAdmin, async (req, res) => {
  try {
    const { nombre, email, password, matricula } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ ok: false, mensaje: "Nombre, email y contraseña son requeridos." });
    }

    const [existe] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (existe.length > 0) {
      return res.status(409).json({ ok: false, mensaje: "Ya existe un usuario con ese email." });
    }

    const colores = ["#6C63FF", "#FF6B6B", "#4ECDC4", "#FFD93D", "#FF6B9D", "#43D9AD"];
    const color = colores[Math.floor(Math.random() * colores.length)];
    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, password, rol, matricula, avatar_color)
       VALUES (?, ?, ?, 'alumno', ?, ?)`,
      [nombre, email.toLowerCase(), hash, matricula || null, color]
    );

    return res.status(201).json({
      ok: true,
      mensaje: "Estudiante creado exitosamente.",
      id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, mensaje: "Error al crear estudiante." });
  }
});

// PUT /api/estudiantes/:id — Actualizar
router.put("/:id", soloAdmin, async (req, res) => {
  try {
    const { nombre, email, matricula, activo } = req.body;

    await pool.query(
      `UPDATE usuarios SET nombre = COALESCE(?, nombre),
                           email = COALESCE(?, email),
                           matricula = COALESCE(?, matricula),
                           activo = COALESCE(?, activo)
       WHERE id = ? AND rol = 'alumno'`,
      [nombre, email?.toLowerCase(), matricula, activo, req.params.id]
    );

    return res.json({ ok: true, mensaje: "Estudiante actualizado correctamente." });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: "Error al actualizar estudiante." });
  }
});

// DELETE /api/estudiantes/:id — Desactivar
router.delete("/:id", soloAdmin, async (req, res) => {
  try {
    await pool.query(
      "UPDATE usuarios SET activo = FALSE WHERE id = ? AND rol = 'alumno'",
      [req.params.id]
    );
    return res.json({ ok: true, mensaje: "Estudiante desactivado correctamente." });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: "Error al eliminar estudiante." });
  }
});

module.exports = router;
