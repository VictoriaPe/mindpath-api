// routes/dashboard.js — Datos del Dashboard para MindPath
const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { verificarToken } = require("../middleware/auth");

// Todos los endpoints requieren autenticación
router.use(verificarToken);

// ─────────────────────────────────────
//  GET /api/dashboard/stats
//  KPIs principales según rol
// ─────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const { id, rol } = req.usuario;
    let stats = {};

    if (rol === "alumno") {
      // Tareas pendientes del alumno
      const [pendientes] = await pool.query(
        `SELECT COUNT(*) as total FROM tareas t
         INNER JOIN inscripciones i ON i.curso_id = t.curso_id
         WHERE i.alumno_id = ? AND t.estado = 'pendiente'
         AND t.fecha_limite > NOW()`,
        [id]
      );

      // Tareas entregadas
      const [entregadas] = await pool.query(
        `SELECT COUNT(*) as total FROM entregas WHERE alumno_id = ?`,
        [id]
      );

      // Cursos inscritos
      const [cursos] = await pool.query(
        `SELECT COUNT(*) as total FROM inscripciones WHERE alumno_id = ?`,
        [id]
      );

      // Puntos del alumno
      const [puntosRow] = await pool.query(
        `SELECT puntos FROM usuarios WHERE id = ?`,
        [id]
      );

      // Ranking del alumno
      const [ranking] = await pool.query(
        `SELECT COUNT(*) + 1 as posicion FROM usuarios
         WHERE rol = 'alumno' AND puntos > (SELECT puntos FROM usuarios WHERE id = ?)`,
        [id]
      );

      stats = {
        tareas_pendientes: pendientes[0].total,
        tareas_entregadas: entregadas[0].total,
        cursos_inscritos: cursos[0].total,
        puntos: puntosRow[0]?.puntos || 0,
        posicion_ranking: ranking[0].posicion,
      };
    } else if (rol === "docente" || rol === "admin") {
      // Total alumnos activos
      const [alumnos] = await pool.query(
        `SELECT COUNT(*) as total FROM usuarios WHERE rol = 'alumno' AND activo = TRUE`
      );

      // Total cursos
      const [cursos] = await pool.query(
        `SELECT COUNT(*) as total FROM cursos WHERE activo = TRUE`
      );

      // Total tareas
      const [tareas] = await pool.query(
        `SELECT COUNT(*) as total FROM tareas`
      );

      // Entregas registradas
      const [entregas] = await pool.query(
        `SELECT COUNT(*) as total FROM entregas`
      );

      stats = {
        total_alumnos: alumnos[0].total,
        total_cursos: cursos[0].total,
        total_tareas: tareas[0].total,
        total_entregas: entregas[0].total,
      };
    }

    return res.json({ ok: true, stats });
  } catch (err) {
    console.error("Error en /stats:", err);
    return res.status(500).json({ ok: false, mensaje: "Error al obtener estadísticas." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/tareas-proximas
//  Próximas 5 tareas a vencer (alumno)
// ─────────────────────────────────────
router.get("/tareas-proximas", async (req, res) => {
  try {
    const { id, rol } = req.usuario;

    let rows;
    if (rol === "alumno") {
      [rows] = await pool.query(
        `SELECT t.id, t.titulo, t.fecha_limite, t.puntos_valor, t.estado,
                c.nombre AS curso, c.color
         FROM tareas t
         INNER JOIN cursos c ON c.id = t.curso_id
         INNER JOIN inscripciones i ON i.curso_id = t.curso_id
         WHERE i.alumno_id = ? AND t.fecha_limite > NOW()
           AND NOT EXISTS (SELECT 1 FROM entregas e WHERE e.tarea_id = t.id AND e.alumno_id = ?)
         ORDER BY t.fecha_limite ASC
         LIMIT 5`,
        [id, id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT t.id, t.titulo, t.fecha_limite, t.puntos_valor, t.estado,
                c.nombre AS curso, c.color
         FROM tareas t
         INNER JOIN cursos c ON c.id = t.curso_id
         ORDER BY t.fecha_limite ASC
         LIMIT 5`
      );
    }

    return res.json({ ok: true, tareas: rows });
  } catch (err) {
    console.error("Error en /tareas-proximas:", err);
    return res.status(500).json({ ok: false, mensaje: "Error al obtener tareas." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/ranking
//  Top 5 alumnos por puntos
// ─────────────────────────────────────
router.get("/ranking", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, puntos, avatar_color, matricula
       FROM usuarios
       WHERE rol = 'alumno' AND activo = TRUE
       ORDER BY puntos DESC
       LIMIT 5`
    );

    return res.json({ ok: true, ranking: rows });
  } catch (err) {
    console.error("Error en /ranking:", err);
    return res.status(500).json({ ok: false, mensaje: "Error al obtener ranking." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/cursos
//  Cursos del usuario actual
// ─────────────────────────────────────
router.get("/cursos", async (req, res) => {
  try {
    const { id, rol } = req.usuario;
    let rows;

    if (rol === "alumno") {
      [rows] = await pool.query(
        `SELECT c.id, c.nombre, c.codigo, c.descripcion, c.color,
                u.nombre AS docente,
                (SELECT COUNT(*) FROM tareas t WHERE t.curso_id = c.id) AS total_tareas,
                (SELECT COUNT(*) FROM tareas t
                 INNER JOIN entregas e ON e.tarea_id = t.id
                 WHERE t.curso_id = c.id AND e.alumno_id = ?) AS entregadas
         FROM cursos c
         INNER JOIN inscripciones i ON i.curso_id = c.id
         LEFT JOIN usuarios u ON u.id = c.docente_id
         WHERE i.alumno_id = ? AND c.activo = TRUE`,
        [id, id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT c.id, c.nombre, c.codigo, c.descripcion, c.color,
                u.nombre AS docente,
                (SELECT COUNT(*) FROM tareas t WHERE t.curso_id = c.id) AS total_tareas,
                (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id) AS total_alumnos
         FROM cursos c
         LEFT JOIN usuarios u ON u.id = c.docente_id
         WHERE c.activo = TRUE`
      );
    }

    return res.json({ ok: true, cursos: rows });
  } catch (err) {
    console.error("Error en /cursos:", err);
    return res.status(500).json({ ok: false, mensaje: "Error al obtener cursos." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/actividad
//  Actividad reciente (últimas entregas)
// ─────────────────────────────────────
router.get("/actividad", async (req, res) => {
  try {
    const { id, rol } = req.usuario;
    let rows;

    if (rol === "alumno") {
      [rows] = await pool.query(
        `SELECT e.entregado_en, e.a_tiempo, e.puntos_ganados,
                t.titulo AS tarea, c.nombre AS curso, c.color
         FROM entregas e
         INNER JOIN tareas t ON t.id = e.tarea_id
         INNER JOIN cursos c ON c.id = t.curso_id
         WHERE e.alumno_id = ?
         ORDER BY e.entregado_en DESC
         LIMIT 8`,
        [id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT e.entregado_en, e.a_tiempo, e.puntos_ganados,
                t.titulo AS tarea, c.nombre AS curso, c.color,
                u.nombre AS alumno
         FROM entregas e
         INNER JOIN tareas t ON t.id = e.tarea_id
         INNER JOIN cursos c ON c.id = t.curso_id
         INNER JOIN usuarios u ON u.id = e.alumno_id
         ORDER BY e.entregado_en DESC
         LIMIT 8`
      );
    }

    return res.json({ ok: true, actividad: rows });
  } catch (err) {
    console.error("Error en /actividad:", err);
    return res.status(500).json({ ok: false, mensaje: "Error al obtener actividad." });
  }
});

module.exports = router;
