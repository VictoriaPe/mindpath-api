// middleware/auth.js — Verificación de JWT para MindPath
const jwt = require("jsonwebtoken");

function verificarToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      ok: false,
      mensaje: "Acceso denegado. Token no proporcionado.",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    return res.status(403).json({
      ok: false,
      mensaje: "Token inválido o expirado. Por favor inicia sesión nuevamente.",
    });
  }
}

function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== "admin") {
    return res.status(403).json({
      ok: false,
      mensaje: "Acceso restringido. Se requiere rol de administrador.",
    });
  }
  next();
}

function soloDocente(req, res, next) {
  if (!["admin", "docente"].includes(req.usuario?.rol)) {
    return res.status(403).json({
      ok: false,
      mensaje: "Acceso restringido. Se requiere rol de docente.",
    });
  }
  next();
}

module.exports = { verificarToken, soloAdmin, soloDocente };
