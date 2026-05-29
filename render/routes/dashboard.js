// routes/dashboard.js — Endpoints del Dashboard MindPath
const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { verificarToken } = require("../middleware/auth");

router.use(verificarToken);

// ─────────────────────────────────────
//  GET /api/dashboard/stats
// ─────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const { id, rol } = req.usuario;

    if (rol === "alumno") {
      const [[pendientes]] = await pool.query(
        `SELECT COUNT(*) AS c FROM tareas t
         JOIN inscripciones i ON i.curso_id = t.curso_id
         WHERE i.alumno_id = ? AND t.fecha_limite >= NOW()
           AND NOT EXISTS (SELECT 1 FROM entregas e WHERE e.tarea_id = t.id AND e.alumno_id = ?)`,
        [id, id]
      );
      const [[entregadas]] = await pool.query(
        `SELECT COUNT(*) AS c FROM entregas WHERE alumno_id = ?`,
        [id]
      );
      const [[cursos]] = await pool.query(
        `SELECT COUNT(*) AS c FROM inscripciones WHERE alumno_id = ?`,
        [id]
      );
      const [[user]] = await pool.query(
        `SELECT puntos FROM usuarios WHERE id = ?`,
        [id]
      );
      return res.json({
        ok: true,
        stats: {
          tareas_pendientes: pendientes.c,
          tareas_entregadas: entregadas.c,
          cursos_inscritos:  cursos.c,
          puntos:            user?.puntos || 0,
        }
      });
    } else {
      const [[alumnos]] = await pool.query(`SELECT COUNT(*) AS c FROM usuarios WHERE rol='alumno' AND activo=TRUE`);
      const [[cursos]]  = await pool.query(`SELECT COUNT(*) AS c FROM cursos WHERE activo=TRUE`);
      const [[tareas]]  = await pool.query(`SELECT COUNT(*) AS c FROM tareas`);
      const [[entregas]]= await pool.query(`SELECT COUNT(*) AS c FROM entregas`);
      return res.json({
        ok: true,
        stats: {
          total_alumnos:  alumnos.c,
          total_cursos:   cursos.c,
          total_tareas:   tareas.c,
          total_entregas: entregas.c,
        }
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: "Error al obtener estadísticas." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/tareas-proximas
// ─────────────────────────────────────
router.get("/tareas-proximas", async (req, res) => {
  try {
    const { id, rol } = req.usuario;
    let rows;

    if (rol === "alumno") {
      [rows] = await pool.query(
        `SELECT t.id, t.titulo, t.fecha_limite, t.puntos_valor, c.nombre AS curso, c.color,
                (SELECT COUNT(*) FROM entregas e WHERE e.tarea_id=t.id AND e.alumno_id=?) AS ya_entregada
         FROM tareas t
         JOIN cursos c ON c.id = t.curso_id
         JOIN inscripciones i ON i.curso_id = t.curso_id AND i.alumno_id = ?
         WHERE t.fecha_limite >= NOW()
           AND NOT EXISTS (SELECT 1 FROM entregas e WHERE e.tarea_id=t.id AND e.alumno_id=?)
         ORDER BY t.fecha_limite ASC
         LIMIT 5`,
        [id, id, id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT t.id, t.titulo, t.fecha_limite, t.puntos_valor, c.nombre AS curso, c.color, 0 AS ya_entregada
         FROM tareas t JOIN cursos c ON c.id = t.curso_id
         WHERE t.fecha_limite >= NOW()
         ORDER BY t.fecha_limite ASC LIMIT 5`
      );
    }

    res.json({ ok: true, tareas: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: "Error al obtener tareas próximas." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/actividad
// ─────────────────────────────────────
router.get("/actividad", async (req, res) => {
  try {
    const { id, rol } = req.usuario;
    let rows;

    if (rol === "alumno") {
      [rows] = await pool.query(
        `SELECT e.entregado_en, e.a_tiempo, e.puntos_ganados, t.titulo AS tarea,
                c.nombre AS curso, c.color, NULL AS alumno
         FROM entregas e
         JOIN tareas t ON t.id = e.tarea_id
         JOIN cursos c ON c.id = t.curso_id
         WHERE e.alumno_id = ?
         ORDER BY e.entregado_en DESC LIMIT 8`,
        [id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT e.entregado_en, e.a_tiempo, e.puntos_ganados, t.titulo AS tarea,
                c.nombre AS curso, c.color, u.nombre AS alumno
         FROM entregas e
         JOIN tareas t ON t.id = e.tarea_id
         JOIN cursos c ON c.id = t.curso_id
         JOIN usuarios u ON u.id = e.alumno_id
         ORDER BY e.entregado_en DESC LIMIT 10`
      );
    }

    res.json({ ok: true, actividad: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: "Error al obtener actividad." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/cursos
// ─────────────────────────────────────
router.get("/cursos", async (req, res) => {
  try {
    const { id, rol } = req.usuario;
    let rows;

    if (rol === "alumno") {
      [rows] = await pool.query(
        `SELECT c.id, c.nombre, c.codigo, c.descripcion, c.color,
                COUNT(DISTINCT t.id) AS total_tareas,
                COUNT(DISTINCT e.id) AS entregadas
         FROM cursos c
         JOIN inscripciones i ON i.curso_id = c.id AND i.alumno_id = ?
         LEFT JOIN tareas t ON t.curso_id = c.id
         LEFT JOIN entregas e ON e.tarea_id = t.id AND e.alumno_id = ?
         WHERE c.activo = TRUE
         GROUP BY c.id
         ORDER BY c.nombre`,
        [id, id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT c.id, c.nombre, c.codigo, c.descripcion, c.color,
                COUNT(DISTINCT t.id) AS total_tareas,
                COUNT(DISTINCT e.id) AS entregadas
         FROM cursos c
         LEFT JOIN tareas t ON t.curso_id = c.id
         LEFT JOIN entregas e ON e.tarea_id = t.id
         WHERE c.activo = TRUE
         GROUP BY c.id ORDER BY c.nombre`
      );
    }

    res.json({ ok: true, cursos: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: "Error al obtener cursos." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/cursos/:id/tareas
// ─────────────────────────────────────
router.get("/cursos/:id/tareas", async (req, res) => {
  try {
    const { id: userId, rol } = req.usuario;
    const cursoId = req.params.id;

    const [rows] = await pool.query(
      `SELECT t.id, t.titulo, t.descripcion, t.fecha_limite, t.puntos_valor,
              COALESCE(e.id, 0) > 0 AS ya_entregada
       FROM tareas t
       LEFT JOIN entregas e ON e.tarea_id = t.id AND e.alumno_id = ?
       WHERE t.curso_id = ?
       ORDER BY t.fecha_limite ASC`,
      [userId, cursoId]
    );

    res.json({ ok: true, tareas: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: "Error al obtener tareas del curso." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/tareas — TODAS con estado
// ─────────────────────────────────────
router.get("/tareas", async (req, res) => {
  try {
    const { id, rol } = req.usuario;
    let rows;

    if (rol === "alumno") {
      [rows] = await pool.query(
        `SELECT t.id, t.titulo, t.fecha_limite, t.puntos_valor,
                c.nombre AS curso, c.color,
                CASE
                  WHEN e.id IS NOT NULL THEN 'entregada'
                  WHEN t.fecha_limite < NOW() THEN 'vencida'
                  ELSE 'pendiente'
                END AS estado
         FROM tareas t
         JOIN cursos c ON c.id = t.curso_id
         JOIN inscripciones i ON i.curso_id = t.curso_id AND i.alumno_id = ?
         LEFT JOIN entregas e ON e.tarea_id = t.id AND e.alumno_id = ?
         ORDER BY t.fecha_limite ASC`,
        [id, id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT t.id, t.titulo, t.fecha_limite, t.puntos_valor,
                c.nombre AS curso, c.color,
                CASE WHEN t.fecha_limite < NOW() THEN 'vencida' ELSE 'pendiente' END AS estado
         FROM tareas t JOIN cursos c ON c.id = t.curso_id
         ORDER BY t.fecha_limite ASC`
      );
    }

    res.json({ ok: true, tareas: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: "Error al obtener tareas." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/tareas/:id — Detalle
// ─────────────────────────────────────
router.get("/tareas/:id", async (req, res) => {
  try {
    const { id: userId } = req.usuario;
    const tareaId = req.params.id;

    const [rows] = await pool.query(
      `SELECT t.id, t.titulo, t.descripcion, t.fecha_limite, t.puntos_valor,
              c.nombre AS curso, c.color,
              COALESCE(e.id, 0) > 0 AS ya_entregada
       FROM tareas t
       JOIN cursos c ON c.id = t.curso_id
       LEFT JOIN entregas e ON e.tarea_id = t.id AND e.alumno_id = ?
       WHERE t.id = ? LIMIT 1`,
      [userId, tareaId]
    );

    if (!rows.length) return res.status(404).json({ ok: false, mensaje: "Tarea no encontrada." });
    res.json({ ok: true, tarea: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: "Error al obtener tarea." });
  }
});

// ─────────────────────────────────────
//  POST /api/dashboard/entregar/:id
// ─────────────────────────────────────
router.post("/entregar/:id", async (req, res) => {
  try {
    const { id: userId } = req.usuario;
    const tareaId = req.params.id;

    // Verificar que la tarea existe y el alumno está inscrito
    const [tareas] = await pool.query(
      `SELECT t.id, t.fecha_limite, t.puntos_valor
       FROM tareas t
       JOIN inscripciones i ON i.curso_id = t.curso_id AND i.alumno_id = ?
       WHERE t.id = ? LIMIT 1`,
      [userId, tareaId]
    );

    if (!tareas.length) return res.status(404).json({ ok: false, mensaje: "Tarea no encontrada o no autorizado." });
    const tarea = tareas[0];

    // Verificar si ya entregó
    const [yaEntrego] = await pool.query(
      `SELECT id FROM entregas WHERE tarea_id = ? AND alumno_id = ? LIMIT 1`,
      [tareaId, userId]
    );
    if (yaEntrego.length) return res.status(409).json({ ok: false, mensaje: "Ya entregaste esta tarea." });

    const ahora = new Date();
    const limite = new Date(tarea.fecha_limite);
    const aTiempo = ahora <= limite;
    const puntosGanados = aTiempo ? tarea.puntos_valor : 0;

    // Registrar entrega
    await pool.query(
      `INSERT INTO entregas (tarea_id, alumno_id, a_tiempo, puntos_ganados) VALUES (?, ?, ?, ?)`,
      [tareaId, userId, aTiempo, puntosGanados]
    );

    // Sumar puntos al usuario
    if (puntosGanados > 0) {
      await pool.query(`UPDATE usuarios SET puntos = puntos + ? WHERE id = ?`, [puntosGanados, userId]);
    }

    // Obtener puntos totales actualizados
    const [[user]] = await pool.query(`SELECT puntos FROM usuarios WHERE id = ?`, [userId]);

    res.json({
      ok: true,
      mensaje: aTiempo
        ? `¡Tarea entregada a tiempo! +${puntosGanados} puntos 🎉`
        : "Tarea entregada fuera de plazo. Sin puntos esta vez.",
      puntos_ganados: puntosGanados,
      puntos_totales: user?.puntos || 0,
      a_tiempo: aTiempo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: "Error al registrar entrega." });
  }
});

// ─────────────────────────────────────
//  GET /api/dashboard/ranking
// ─────────────────────────────────────
router.get("/ranking", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, matricula, avatar_color, puntos
       FROM usuarios
       WHERE rol = 'alumno' AND activo = TRUE
       ORDER BY puntos DESC, nombre ASC
       LIMIT 20`
    );
    res.json({ ok: true, ranking: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: "Error al obtener ranking." });
  }
});

module.exports = router;
