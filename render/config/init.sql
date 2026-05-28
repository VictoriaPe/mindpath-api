-- ============================================================
--  MindPath — Script de Inicialización de Base de Datos
--  Ejecutar una sola vez para crear tablas y datos demo
--  Comando: mysql -u root -p < init.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS mindpath_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mindpath_db;

-- ─────────────────────────────────────────
--  TABLA: usuarios
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  rol         ENUM('admin','docente','alumno') NOT NULL DEFAULT 'alumno',
  matricula   VARCHAR(20)   UNIQUE,
  activo      BOOLEAN       NOT NULL DEFAULT TRUE,
  avatar_color VARCHAR(7)   DEFAULT '#6C63FF',
  puntos      INT           NOT NULL DEFAULT 0,
  creado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME   ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
--  TABLA: cursos
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cursos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(150)  NOT NULL,
  codigo      VARCHAR(20)   NOT NULL UNIQUE,
  descripcion TEXT,
  docente_id  INT,
  color       VARCHAR(7)    DEFAULT '#4ECDC4',
  activo      BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
--  TABLA: tareas
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tareas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  titulo      VARCHAR(200)  NOT NULL,
  descripcion TEXT,
  curso_id    INT           NOT NULL,
  fecha_limite DATETIME     NOT NULL,
  puntos_valor INT          NOT NULL DEFAULT 10,
  estado      ENUM('pendiente','entregada','vencida') DEFAULT 'pendiente',
  creado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
--  TABLA: inscripciones (alumno ↔ curso)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inscripciones (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id   INT NOT NULL,
  curso_id    INT NOT NULL,
  inscrito_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_alumno_curso (alumno_id, curso_id),
  FOREIGN KEY (alumno_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (curso_id)  REFERENCES cursos(id)  ON DELETE CASCADE
);

-- ─────────────────────────────────────────
--  TABLA: entregas
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entregas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tarea_id    INT NOT NULL,
  alumno_id   INT NOT NULL,
  entregado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  a_tiempo    BOOLEAN NOT NULL DEFAULT TRUE,
  puntos_ganados INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_tarea_alumno (tarea_id, alumno_id),
  FOREIGN KEY (tarea_id)  REFERENCES tareas(id)   ON DELETE CASCADE,
  FOREIGN KEY (alumno_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
--  DATOS DEMO
-- ─────────────────────────────────────────

-- Contraseña para todos: "mindpath2026" (bcrypt hash)
INSERT INTO usuarios (nombre, email, password, rol, matricula, avatar_color, puntos) VALUES
('Administrador',     'admin@mindpath.edu.do',       '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHam', 'admin',   NULL,        '#FF6B6B', 500),
('Prof. Ramírez',     'docente@mindpath.edu.do',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHam', 'docente', NULL,        '#4ECDC4', 0),
('Victoria Peña',     'victoria@mindpath.edu.do',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHam', 'alumno',  '2024-001',  '#6C63FF', 340),
('Francis Taveras',   'francis@mindpath.edu.do',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHam', 'alumno',  '2024-002',  '#FFD93D', 280),
('Yarisvett Padilla', 'yarisvett@mindpath.edu.do',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHam', 'alumno',  '2024-003',  '#FF6B9D', 195),
('Jesús Sánchez',     'jesus@mindpath.edu.do',       '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHam', 'alumno',  '2024-004',  '#43D9AD', 410)
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO cursos (nombre, codigo, descripcion, docente_id, color) VALUES
('Desarrollo Web y Multimedia',   'DWM-101', 'Diseño y desarrollo de soluciones web modernas.',        2, '#6C63FF'),
('Bases de Datos',                'BD-201',  'Modelado relacional y consultas SQL avanzadas.',          2, '#FF6B6B'),
('Programación Orientada a Objetos', 'POO-301', 'Principios de POO con Java y Python.',               2, '#4ECDC4'),
('Redes y Comunicaciones',        'RC-401',  'Fundamentos de redes, TCP/IP y seguridad informática.',  2, '#FFD93D')
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO tareas (titulo, descripcion, curso_id, fecha_limite, puntos_valor) VALUES
('Proyecto Final — Sitio Web Completo',  'Entregar el proyecto final con frontend y backend integrados.', 1, DATE_ADD(NOW(), INTERVAL 5 DAY),  20),
('Tarea 1 — Diseño Entidad-Relación',    'Diseñar el diagrama ER de una tienda en línea.',               2, DATE_ADD(NOW(), INTERVAL 2 DAY),  15),
('Tarea 2 — Consultas SQL Avanzadas',    'Resolver ejercicios de JOINs, subconsultas y funciones.',      2, DATE_ADD(NOW(), INTERVAL 7 DAY),  15),
('Ejercicio POO — Herencia y Polim.',    'Implementar jerarquía de clases de un sistema bancario.',      3, DATE_ADD(NOW(), INTERVAL 3 DAY),  10),
('Lab Redes — Configurar Router',        'Documentar la configuración de un router Cisco simulado.',     4, DATE_ADD(NOW(), INTERVAL 1 DAY),  10)
ON DUPLICATE KEY UPDATE id=id;

-- Inscripciones: alumnos (id 3,4,5,6) a todos los cursos (1,2,3,4)
INSERT IGNORE INTO inscripciones (alumno_id, curso_id) VALUES
(3,1),(3,2),(3,3),(3,4),
(4,1),(4,2),(4,3),(4,4),
(5,1),(5,2),(5,3),(5,4),
(6,1),(6,2),(6,3),(6,4);

SELECT '✅ MindPath DB inicializada correctamente.' AS mensaje;
