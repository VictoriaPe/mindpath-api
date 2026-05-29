// js/dashboard.js — MindPath v2.0
// Calendario · Perfil · Asistente IA · Crear tareas · Ranking dinámico

const API = (typeof BACKEND_URL !== "undefined" ? BACKEND_URL : "http://localhost:3000") + "/api";

let usuario = null;
let token   = null;
let todasLasTareas      = [];
let todosLosEstudiantes = [];
let calendarioEventos   = [];
let mesActual  = new Date().getMonth() + 1;
let anioActual = new Date().getFullYear();
let searchTimeout = null;

// ============================================================
// INIT
// ============================================================
(async function init() {
  token = localStorage.getItem("mp_token") || sessionStorage.getItem("mp_token");
  const userRaw = localStorage.getItem("mp_user") || sessionStorage.getItem("mp_user");
  if (!token || !userRaw) { window.location.href = "/login"; return; }
  try { usuario = JSON.parse(userRaw); } catch { window.location.href = "/login"; return; }

  setupUI();
  updateDate();
  await loadDashboard();
  await loadCursosResumen();
})();

// ============================================================
// UI SETUP
// ============================================================
function setupUI() {
  const initial = usuario.nombre?.charAt(0).toUpperCase() || "U";
  const color   = usuario.avatar_color || "#7C3AED";
  ["nav-avatar","topbar-avatar"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = initial; el.style.background = color; }
  });
  document.getElementById("nav-nombre").textContent = usuario.nombre || "Usuario";
  document.getElementById("nav-rol").textContent    = capitalize(usuario.rol || "alumno");
  if (["admin","docente"].includes(usuario.rol)) {
    document.getElementById("admin-section").style.display = "block";
    document.querySelectorAll(".admin-only").forEach(el => el.style.display = "flex");
  }
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ""; }

function updateDate() {
  const el = document.getElementById("topbar-date");
  if (el) el.textContent = new Date().toLocaleDateString("es-DO",
    { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}

// ============================================================
// NAVEGACIÓN
// ============================================================
function navigateTo(section, el) {
  document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const target = document.getElementById(`section-${section}`);
  if (target) target.classList.add("active");
  if (el) el.classList.add("active");

  const titulos = {
    dashboard:   ["Dashboard",      "Resumen general de tu actividad"],
    cursos:      ["Mis Cursos",     "Materias en las que estás inscrito"],
    tareas:      ["Tareas",         "Gestiona tus entregas académicas"],
    ranking:     ["Ranking",        "Top estudiantes por puntos acumulados"],
    calendario:  ["Calendario",     "Tu agenda académica personalizada"],
    perfil:      ["Mi Perfil",      "Tu información y configuración"],
    asistente:   ["Asistente IA",   "Tu tutor inteligente MindPath"],
    estudiantes: ["Estudiantes",    "Gestión de usuarios del sistema"],
  };
  const [titulo, subtitulo] = titulos[section] || ["MindPath",""];
  document.getElementById("page-title").textContent    = titulo;
  document.getElementById("page-subtitle").textContent = subtitulo;

  if (window.innerWidth <= 768) toggleSidebar();

  if (section === "cursos")      loadCursos();
  if (section === "tareas")      loadTareas();
  if (section === "ranking")     loadRanking();
  if (section === "calendario")  loadCalendario();
  if (section === "perfil")      loadPerfil();
  if (section === "estudiantes") loadEstudiantes();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebar-overlay").classList.toggle("active");
}

// ============================================================
// FETCH HELPER
// ============================================================
async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${API}${endpoint}`, {
      ...options,
      headers: { Authorization:`Bearer ${token}`, "Content-Type":"application/json", ...options.headers },
    });
    if (res.status === 401 || res.status === 403) { logout(); return null; }
    return res.json();
  } catch (err) { console.error("Red:", err); return null; }
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  const [statsData, tareasData, actividadData] = await Promise.all([
    apiFetch("/dashboard/stats"),
    apiFetch("/dashboard/tareas-proximas"),
    apiFetch("/dashboard/actividad"),
  ]);
  renderKPIs(statsData?.stats);
  renderTareasProximas(tareasData?.tareas || []);
  renderActividad(actividadData?.actividad || []);
}

async function loadCursosResumen() {
  const data = await apiFetch("/dashboard/cursos");
  const badge = document.getElementById("badge-tareas");
  if (badge) badge.textContent = data?.cursos?.length || 0;
}

function renderKPIs(stats) {
  if (!stats) return;
  const grid = document.getElementById("kpi-grid");
  let cards = usuario.rol === "alumno"
    ? [
        { label:"Tareas Pendientes", value:stats.tareas_pendientes??0, icon:"📋", color:"yellow" },
        { label:"Tareas Entregadas", value:stats.tareas_entregadas??0, icon:"✅", color:"green" },
        { label:"Cursos Inscritos",  value:stats.cursos_inscritos??0,  icon:"📚", color:"blue" },
        { label:"Puntos Ganados",    value:stats.puntos??0,            icon:"⭐", color:"purple" },
      ]
    : [
        { label:"Total Alumnos",  value:stats.total_alumnos??0,  icon:"👥", color:"purple" },
        { label:"Cursos Activos", value:stats.total_cursos??0,   icon:"📚", color:"blue" },
        { label:"Total Tareas",   value:stats.total_tareas??0,   icon:"📋", color:"yellow" },
        { label:"Entregas",       value:stats.total_entregas??0, icon:"✅", color:"green" },
      ];

  grid.innerHTML = cards.map((c,i) => `
    <div class="kpi-card ${c.color}" style="animation-delay:${i*0.1}s">
      <div class="kpi-icon ${c.color}">${c.icon}</div>
      <div class="kpi-value" data-target="${c.value}">0</div>
      <div class="kpi-label">${c.label}</div>
    </div>`).join("");
  grid.querySelectorAll(".kpi-value").forEach(el => animateCounter(el, parseInt(el.dataset.target)));
}

function animateCounter(el, target) {
  const start = performance.now();
  function update(now) {
    const p = Math.min((now - start) / 1200, 1);
    el.textContent = Math.round((1 - Math.pow(1-p, 3)) * target).toLocaleString("es-DO");
    if (p < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function renderTareasProximas(tareas) {
  const list = document.getElementById("task-list");
  if (!tareas.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><p>¡Sin tareas pendientes!</p></div>`; return; }
  list.innerHTML = tareas.map(t => {
    const dias = diasRestantes(t.fecha_limite);
    let cls = "normal", lbl = `${dias}d`;
    if (dias <= 0) { cls = "urgente"; lbl = "Hoy"; }
    else if (dias === 1) { cls = "urgente"; lbl = "Mañana"; }
    else if (dias <= 3)  { cls = "pronto"; }
    return `<div class="task-item" onclick="verDetalleTarea(${t.id})">
      <div class="task-color-dot" style="background:${t.color}"></div>
      <div class="task-info">
        <div class="task-title">${escapeHtml(t.titulo)}</div>
        <div class="task-meta">${escapeHtml(t.curso)} · ${formatDate(t.fecha_limite)}</div>
      </div>
      <span class="task-badge ${cls}">${lbl}</span>
    </div>`;
  }).join("");
}

function renderActividad(actividad) {
  const list = document.getElementById("activity-list");
  if (!actividad.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Sin actividad reciente</p></div>`; return; }
  list.innerHTML = actividad.map(a => {
    const quien = a.alumno ? `<strong>${escapeHtml(a.alumno)}</strong> entregó` : "Entregaste";
    return `<div class="activity-item">
      <div class="activity-dot" style="background:${a.color}"></div>
      <div class="activity-text">${quien} <strong>${escapeHtml(a.tarea)}</strong>
        en ${escapeHtml(a.curso)}
        ${a.a_tiempo ? `· <span style="color:var(--green)">+${a.puntos_ganados} pts</span>` : "· Fuera de plazo"}</div>
      <span class="activity-time">${timeAgo(a.entregado_en)}</span>
    </div>`;
  }).join("");
}

// ============================================================
// DETALLE Y ENTREGA DE TAREA
// ============================================================
async function verDetalleTarea(tareaId) {
  const data = await apiFetch(`/dashboard/tareas/${tareaId}`);
  if (!data?.ok) { showToast("Error al cargar la tarea.", "error"); return; }
  const t = data.tarea;
  const yaEntregada = t.ya_entregada === 1;
  const vencida     = new Date(t.fecha_limite) < new Date();

  const accion = usuario.rol === "alumno" && !yaEntregada && !vencida
    ? `<button class="btn-primary" style="width:100%" onclick="entregarTarea(${t.id})">📤 Entregar tarea · +${t.puntos_valor} pts</button>`
    : yaEntregada ? `<div class="status-box success">✅ Tarea ya entregada</div>`
    : `<div class="status-box error">⏰ Esta tarea ya venció</div>`;

  abrirModal("modal-tarea-detail", `
    <div class="modal-header">
      <h3>📋 ${escapeHtml(t.titulo)}</h3>
      <button class="modal-close" onclick="cerrarModal('modal-tarea-detail')">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <span class="badge-curso" style="background:${t.color}22;color:${t.color}">${escapeHtml(t.curso)}</span>
        <span class="badge-meta">📅 ${formatDate(t.fecha_limite)}</span>
        <span class="badge-meta" style="color:var(--purple)">⭐ +${t.puntos_valor} pts</span>
      </div>
      <div class="desc-box">${escapeHtml(t.descripcion || "Sin descripción adicional.")}</div>
      <div style="margin-top:16px">${accion}</div>
    </div>`);
}

async function entregarTarea(tareaId) {
  const data = await apiFetch(`/dashboard/entregar/${tareaId}`, { method:"POST" });
  if (data?.ok) {
    showToast(data.mensaje, "success");
    cerrarModal("modal-tarea-detail");
    setTimeout(() => loadDashboard(), 800);
  } else showToast(data?.mensaje || "Error.", "error");
}

// ============================================================
// CURSOS
// ============================================================
async function loadCursos() {
  const grid = document.getElementById("courses-grid");
  grid.innerHTML = `<div class="loading-state full"><div class="spinner-lg"></div></div>`;
  const data = await apiFetch("/dashboard/cursos");
  const cursos = data?.cursos || [];
  if (!cursos.length) { grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No hay cursos.</p></div>`; return; }
  grid.innerHTML = cursos.map((c,i) => {
    const pct = c.total_tareas > 0 ? Math.round((c.entregadas / c.total_tareas) * 100) : 0;
    return `<div class="course-card" style="animation-delay:${i*0.08}s">
      <div class="course-header" style="background:linear-gradient(135deg,${c.color}33,${c.color}11)">
        <div class="course-badge" style="background:${c.color}">${c.codigo}</div>
        <div class="course-dots">
          <span style="background:${c.color}"></span>
          <span style="background:${c.color}99"></span>
          <span style="background:${c.color}55"></span>
        </div>
      </div>
      <div class="course-body">
        <h4 class="course-name">${escapeHtml(c.nombre)}</h4>
        <p class="course-desc">${escapeHtml(c.descripcion || "")}</p>
        <div class="course-progress">
          <div class="progress-row"><span>${c.entregadas} de ${c.total_tareas} tareas</span><span>${pct}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${c.color}"></div></div>
        </div>
        <div class="course-footer">
          <span>👨‍🏫 ${escapeHtml(c.docente || "Docente")}</span>
          <button class="btn-curso" style="border-color:${c.color};color:${c.color}"
            onclick="verTareasCurso(${c.id},'${escapeHtml(c.nombre)}')">Ver tareas</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

async function verTareasCurso(cursoId, nombre) {
  const data   = await apiFetch(`/dashboard/cursos/${cursoId}/tareas`);
  const tareas = data?.tareas || [];
  const html   = tareas.length
    ? tareas.map(t => {
        const estado = t.ya_entregada ? "entregada" : new Date(t.fecha_limite)<new Date() ? "vencida" : "pendiente";
        const lbl = {entregada:"✅ Entregada",vencida:"⏰ Vencida",pendiente:"📋 Pendiente"}[estado];
        return `<div class="task-row" onclick="verDetalleTarea(${t.id})">
          <div>
            <div class="task-title">${escapeHtml(t.titulo)}</div>
            <div class="task-meta">📅 ${formatDate(t.fecha_limite)} · ⭐ ${t.puntos_valor} pts</div>
          </div>
          <span class="status-pill ${estado}">${lbl}</span>
        </div>`;
      }).join("")
    : `<div class="empty-state"><div class="empty-icon">📝</div><p>Sin tareas en este curso</p></div>`;
  abrirModal("modal-curso-tareas", `
    <div class="modal-header">
      <h3>📚 ${escapeHtml(nombre)}</h3>
      <button class="modal-close" onclick="cerrarModal('modal-curso-tareas')">✕</button>
    </div>
    <div class="modal-body">${html}</div>`);
}

// ============================================================
// TAREAS
// ============================================================
async function loadTareas(filtro = "todas") {
  document.getElementById("tasks-table-wrap").innerHTML = `<div class="loading-state full"><div class="spinner-lg"></div></div>`;
  const data = await apiFetch("/dashboard/tareas");
  todasLasTareas = data?.tareas || [];

  // Mostrar botón de crear tarea si es docente/admin
  const toolbar = document.querySelector("#section-tareas .section-toolbar");
  if (toolbar && ["admin","docente"].includes(usuario.rol) && !document.getElementById("btn-nueva-tarea")) {
    const btn = document.createElement("button");
    btn.id = "btn-nueva-tarea";
    btn.className = "btn-action";
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva tarea`;
    btn.onclick = abrirModalNuevaTarea;
    toolbar.appendChild(btn);
  }

  renderTablaTareas(filtro);
}

function filterTareas(filtro, btn) {
  document.querySelectorAll(".filter-pill").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderTablaTareas(filtro);
}

function renderTablaTareas(filtro = "todas") {
  const wrap = document.getElementById("tasks-table-wrap");
  let tareas = todasLasTareas;
  if (filtro !== "todas") {
    tareas = tareas.filter(t => {
      const vencida = new Date(t.fecha_limite) < new Date();
      if (filtro === "pendiente") return !t.ya_entregada && !vencida;
      if (filtro === "entregada") return !!t.ya_entregada;
      if (filtro === "vencida")   return !t.ya_entregada && vencida;
      return true;
    });
  }
  if (!tareas.length) { wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No hay tareas con ese filtro.</p></div>`; return; }
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Tarea</th><th>Curso</th><th>Vence</th><th>Pts</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>${tareas.map(t => {
      const vencida = new Date(t.fecha_limite) < new Date();
      const estado  = t.ya_entregada ? "entregada" : vencida ? "vencida" : "pendiente";
      const lbl = {entregada:"✅ Entregada",vencida:"⏰ Vencida",pendiente:"📋 Pendiente"}[estado];
      return `<tr>
        <td><strong>${escapeHtml(t.titulo)}</strong></td>
        <td><span class="badge-curso-sm" style="background:${t.color}22;color:${t.color}">${escapeHtml(t.curso)}</span></td>
        <td style="white-space:nowrap">${formatDate(t.fecha_limite)}</td>
        <td><span style="color:var(--purple)">⭐ ${t.puntos_valor}</span></td>
        <td><span class="status-pill ${estado}">${lbl}</span></td>
        <td><button class="btn-sm-action ${estado==='pendiente'?'':'secondary'}"
          onclick="verDetalleTarea(${t.id})">${estado==='pendiente'?'Entregar':'Ver'}</button></td>
      </tr>`;
    }).join("")}</tbody></table>`;
}

async function abrirModalNuevaTarea() {
  const data   = await apiFetch("/dashboard/cursos");
  const cursos = data?.cursos || [];
  const opts   = cursos.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
  const hoy    = new Date(); hoy.setDate(hoy.getDate() + 7);
  const def    = hoy.toISOString().slice(0,16);

  abrirModal("modal-nueva-tarea", `
    <div class="modal-header">
      <h3>📝 Nueva Tarea</h3>
      <button class="modal-close" onclick="cerrarModal('modal-nueva-tarea')">✕</button>
    </div>
    <div class="modal-body">
      <div class="field-group">
        <label>Título</label>
        <div class="input-wrap"><input type="text" id="nt-titulo" placeholder="Ej: Proyecto Final..." /></div>
      </div>
      <div class="field-group">
        <label>Descripción</label>
        <div class="input-wrap"><textarea id="nt-desc" placeholder="Instrucciones detalladas..."
          style="width:100%;padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:14px;resize:vertical;min-height:80px;outline:none"></textarea></div>
      </div>
      <div class="field-group">
        <label>Curso</label>
        <div class="input-wrap">
          <select id="nt-curso" style="width:100%;padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:14px;outline:none">
            ${opts}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field-group">
          <label>Fecha límite</label>
          <div class="input-wrap"><input type="datetime-local" id="nt-fecha" value="${def}" /></div>
        </div>
        <div class="field-group">
          <label>Puntos</label>
          <div class="input-wrap"><input type="number" id="nt-puntos" value="10" min="1" max="100" /></div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="cerrarModal('modal-nueva-tarea')">Cancelar</button>
      <button class="btn-primary-sm" onclick="crearTarea()"><span>Crear tarea</span></button>
    </div>`);
}

async function crearTarea() {
  const body = {
    titulo:       document.getElementById("nt-titulo")?.value.trim(),
    descripcion:  document.getElementById("nt-desc")?.value.trim(),
    curso_id:     parseInt(document.getElementById("nt-curso")?.value),
    fecha_limite: document.getElementById("nt-fecha")?.value,
    puntos_valor: parseInt(document.getElementById("nt-puntos")?.value) || 10,
  };
  if (!body.titulo) { showToast("El título es obligatorio.", "error"); return; }
  const data = await apiFetch("/dashboard/tareas", { method:"POST", body:JSON.stringify(body) });
  if (data?.ok) {
    showToast(data.mensaje, "success");
    cerrarModal("modal-nueva-tarea");
    loadTareas();
  } else showToast(data?.mensaje || "Error al crear.", "error");
}

// ============================================================
// RANKING
// ============================================================
async function loadRanking() {
  const wrap = document.getElementById("ranking-wrap");
  wrap.innerHTML = `<div class="loading-state full"><div class="spinner-lg"></div></div>`;
  const data    = await apiFetch("/dashboard/ranking");
  const ranking = data?.ranking || [];
  if (!ranking.length) { wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>Sin datos de ranking.</p></div>`; return; }

  const podio = ranking.slice(0, 3);
  const resto = ranking.slice(3);

  wrap.innerHTML = `<div class="ranking-container">
    <div class="podio">
      ${podio.map((u,i) => {
        const medallas = ["🥇","🥈","🥉"];
        const alturas  = [160,130,110];
        const esYo     = u.id === usuario.id;
        return `<div class="podio-item pos-${i+1} ${esYo?"yo":""}">
          <div class="podio-avatar" style="background:${u.avatar_color}">${u.nombre.charAt(0)}</div>
          ${esYo ? `<div style="font-size:10px;color:var(--purple);font-weight:600">TÚ</div>` : ""}
          <div class="podio-nombre">${escapeHtml(u.nombre.split(" ")[0])}</div>
          <div class="podio-puntos">⭐ ${u.puntos.toLocaleString("es-DO")}</div>
          <div class="podio-base" style="height:${alturas[i]}px">
            <span class="podio-pos">${medallas[i]}</span>
          </div>
        </div>`;
      }).join("")}
    </div>
    ${resto.length ? `<div class="ranking-table-wrap"><table class="data-table">
      <thead><tr><th>#</th><th>Estudiante</th><th>Puntos</th><th>Entregas</th></tr></thead>
      <tbody>${resto.map((u,i) => `<tr class="${u.id===usuario.id?"row-yo":""}">
        <td><strong>#${i+4}</strong></td>
        <td><div class="user-cell">
          <div class="avatar-sm" style="background:${u.avatar_color}">${u.nombre.charAt(0)}</div>
          <span>${escapeHtml(u.nombre)} ${u.id===usuario.id?"<em>(tú)</em>":""}</span>
        </div></td>
        <td><span style="color:var(--purple)">⭐ ${u.puntos.toLocaleString("es-DO")}</span></td>
        <td>${u.entregas||0}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : ""}
  </div>`;
}

// ============================================================
// CALENDARIO
// ============================================================
async function loadCalendario() {
  const wrap = document.getElementById("calendario-wrap");
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-state full"><div class="spinner-lg"></div></div>`;
  const data = await apiFetch(`/dashboard/calendario?mes=${mesActual}&anio=${anioActual}`);
  calendarioEventos = data?.eventos || [];
  renderCalendario();
}

function renderCalendario() {
  const wrap = document.getElementById("calendario-wrap");
  if (!wrap) return;

  const diasSemana = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const meses      = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const primerDia  = new Date(anioActual, mesActual - 1, 1).getDay();
  const totalDias  = new Date(anioActual, mesActual, 0).getDate();
  const hoy        = new Date();

  // Agrupar eventos por día
  const eventosPorDia = {};
  calendarioEventos.forEach(ev => {
    const d = new Date(ev.fecha_inicio);
    const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    if (!eventosPorDia[key]) eventosPorDia[key] = [];
    eventosPorDia[key].push(ev);
  });

  let celdasHtml = "";
  for (let i = 0; i < primerDia; i++) celdasHtml += `<div class="cal-day empty"></div>`;

  for (let dia = 1; dia <= totalDias; dia++) {
    const esHoy = dia === hoy.getDate() && mesActual === hoy.getMonth()+1 && anioActual === hoy.getFullYear();
    const key   = `${anioActual}-${mesActual}-${dia}`;
    const evs   = eventosPorDia[key] || [];
    const puntos = evs.slice(0,3).map(e =>
      `<div class="cal-event-dot" style="background:${e.color}" title="${escapeHtml(e.titulo)}"></div>`).join("");
    celdasHtml += `
      <div class="cal-day ${esHoy?"hoy":""}" onclick="verEventosDia(${dia})">
        <span class="cal-num">${dia}</span>
        <div class="cal-dots">${puntos}</div>
        ${evs.length > 3 ? `<span class="cal-more">+${evs.length-3}</span>` : ""}
      </div>`;
  }

  // Lista de eventos próximos
  const proximosEvs = calendarioEventos
    .filter(e => new Date(e.fecha_inicio) >= new Date())
    .sort((a,b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))
    .slice(0,8);

  wrap.innerHTML = `
    <div class="cal-container">
      <div class="cal-main">
        <div class="cal-nav">
          <button class="btn-cal-nav" onclick="cambiarMes(-1)">◀</button>
          <h3 class="cal-title">${meses[mesActual-1]} ${anioActual}</h3>
          <button class="btn-cal-nav" onclick="cambiarMes(1)">▶</button>
          <button class="btn-action" style="margin-left:auto" onclick="abrirModalNuevoEvento()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo evento
          </button>
        </div>
        <div class="cal-grid-header">
          ${diasSemana.map(d => `<div class="cal-day-label">${d}</div>`).join("")}
        </div>
        <div class="cal-grid">${celdasHtml}</div>
      </div>
      <div class="cal-sidebar">
        <h4 style="font-family:var(--font-display);margin-bottom:12px;font-size:14px;color:var(--text-muted)">
          📅 Próximos eventos
        </h4>
        ${proximosEvs.length
          ? proximosEvs.map(e => `
              <div class="cal-ev-item">
                <div class="cal-ev-dot" style="background:${e.color}"></div>
                <div class="cal-ev-info">
                  <div class="cal-ev-titulo">${escapeHtml(e.titulo)}</div>
                  <div class="cal-ev-fecha">${formatDate(e.fecha_inicio)}</div>
                </div>
                ${!e.es_tarea ? `<button class="btn-sm-action danger" style="padding:3px 8px"
                  onclick="eliminarEvento('${e.id}')">✕</button>` : ""}
              </div>`).join("")
          : `<div class="empty-state" style="padding:20px 0"><div class="empty-icon">🗓️</div><p>Sin eventos próximos</p></div>`}
      </div>
    </div>`;
}

function cambiarMes(delta) {
  mesActual += delta;
  if (mesActual > 12) { mesActual = 1;  anioActual++; }
  if (mesActual < 1)  { mesActual = 12; anioActual--; }
  loadCalendario();
}

function verEventosDia(dia) {
  const key = `${anioActual}-${mesActual}-${dia}`;
  const evs = calendarioEventos.filter(e => {
    const d = new Date(e.fecha_inicio);
    return d.getFullYear() === anioActual && d.getMonth()+1 === mesActual && d.getDate() === dia;
  });
  if (!evs.length) { abrirModalNuevoEventoDia(dia); return; }

  const html = evs.map(e => `
    <div class="cal-ev-item" style="margin-bottom:8px">
      <div class="cal-ev-dot" style="background:${e.color}"></div>
      <div class="cal-ev-info">
        <div class="cal-ev-titulo">${escapeHtml(e.titulo)}</div>
        <div class="cal-ev-fecha">${e.descripcion ? escapeHtml(e.descripcion) : ""}</div>
      </div>
    </div>`).join("");

  abrirModal("modal-dia-eventos", `
    <div class="modal-header">
      <h3>📅 ${dia} de ${["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][mesActual]}</h3>
      <button class="modal-close" onclick="cerrarModal('modal-dia-eventos')">✕</button>
    </div>
    <div class="modal-body">${html}
      <button class="btn-secondary" style="width:100%;margin-top:8px"
        onclick="cerrarModal('modal-dia-eventos');abrirModalNuevoEventoDia(${dia})">+ Agregar evento</button>
    </div>`);
}

function abrirModalNuevoEvento() {
  const hoy = new Date().toISOString().slice(0,10);
  mostrarFormEvento(hoy);
}

function abrirModalNuevoEventoDia(dia) {
  const fecha = `${anioActual}-${String(mesActual).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
  mostrarFormEvento(fecha);
}

function mostrarFormEvento(fechaDefault) {
  abrirModal("modal-nuevo-evento", `
    <div class="modal-header">
      <h3>🗓️ Nuevo Evento</h3>
      <button class="modal-close" onclick="cerrarModal('modal-nuevo-evento')">✕</button>
    </div>
    <div class="modal-body">
      <div class="field-group">
        <label>Título</label>
        <div class="input-wrap"><input type="text" id="ev-titulo" placeholder="Ej: Examen de SQL..."/></div>
      </div>
      <div class="field-group">
        <label>Tipo</label>
        <div class="input-wrap">
          <select id="ev-tipo" style="width:100%;padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:14px;outline:none">
            <option value="personal">🙂 Personal</option>
            <option value="examen">📝 Examen</option>
            <option value="tarea">📋 Tarea</option>
            <option value="recordatorio">🔔 Recordatorio</option>
          </select>
        </div>
      </div>
      <div class="field-group">
        <label>Fecha</label>
        <div class="input-wrap"><input type="date" id="ev-fecha" value="${fechaDefault}"/></div>
      </div>
      <div class="field-group">
        <label>Descripción (opcional)</label>
        <div class="input-wrap"><input type="text" id="ev-desc" placeholder="Nota adicional..."/></div>
      </div>
      <div class="field-group">
        <label>Color</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
          ${["#6C63FF","#FF6B6B","#4ECDC4","#FFD93D","#43D9AD","#F97316"].map(c =>
            `<div class="color-swatch" style="background:${c}" data-color="${c}"
              onclick="selectColor(this,'${c}')"></div>`).join("")}
        </div>
        <input type="hidden" id="ev-color" value="#6C63FF"/>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="cerrarModal('modal-nuevo-evento')">Cancelar</button>
      <button class="btn-primary-sm" onclick="crearEvento()"><span>Guardar evento</span></button>
    </div>`);
  // Marcar primer color
  setTimeout(() => {
    const swatches = document.querySelectorAll(".color-swatch");
    if (swatches[0]) swatches[0].classList.add("selected");
  }, 100);
}

function selectColor(el, color) {
  document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
  el.classList.add("selected");
  document.getElementById("ev-color").value = color;
}

async function crearEvento() {
  const body = {
    titulo:      document.getElementById("ev-titulo")?.value.trim(),
    descripcion: document.getElementById("ev-desc")?.value.trim(),
    fecha_inicio: document.getElementById("ev-fecha")?.value,
    color:        document.getElementById("ev-color")?.value || "#6C63FF",
    tipo:         document.getElementById("ev-tipo")?.value,
  };
  if (!body.titulo || !body.fecha_inicio) { showToast("Título y fecha son obligatorios.", "error"); return; }
  const data = await apiFetch("/dashboard/calendario", { method:"POST", body:JSON.stringify(body) });
  if (data?.ok) {
    showToast("Evento guardado ✓", "success");
    cerrarModal("modal-nuevo-evento");
    loadCalendario();
  } else showToast(data?.mensaje || "Error.", "error");
}

async function eliminarEvento(id) {
  const data = await apiFetch(`/dashboard/calendario/${id}`, { method:"DELETE" });
  if (data?.ok) { showToast("Evento eliminado.", "success"); loadCalendario(); }
  else showToast("Error al eliminar.", "error");
}

// ============================================================
// PERFIL
// ============================================================
async function loadPerfil() {
  const wrap = document.getElementById("perfil-wrap");
  if (!wrap) return;
  wrap.innerHTML = `<div class="loading-state full"><div class="spinner-lg"></div></div>`;
  const data = await apiFetch("/dashboard/perfil");
  if (!data?.ok) { wrap.innerHTML = `<div class="empty-state"><p>Error al cargar perfil.</p></div>`; return; }
  const u = data.usuario;

  const colores = ["#6C63FF","#FF6B6B","#4ECDC4","#FFD93D","#FF6B9D","#43D9AD","#F97316","#38BDF8"];

  wrap.innerHTML = `
    <div class="perfil-container">
      <!-- Tarjeta de perfil -->
      <div class="perfil-card">
        <div class="perfil-banner" style="background:linear-gradient(135deg,${u.avatar_color}55,${u.avatar_color}22)"></div>
        <div class="perfil-avatar-wrap">
          <div class="perfil-avatar" id="perfil-avatar-display" style="background:${u.avatar_color}">
            ${u.nombre.charAt(0).toUpperCase()}
          </div>
        </div>
        <div class="perfil-info">
          <h2 class="perfil-nombre">${escapeHtml(u.nombre)}</h2>
          <span class="perfil-rol">${capitalize(u.rol)}</span>
          ${u.matricula ? `<span class="perfil-matricula">Matrícula: ${u.matricula}</span>` : ""}
          <p class="perfil-bio">${escapeHtml(u.bio || "Sin biografía. ¡Edita tu perfil para agregar una!")}</p>
        </div>
        <div class="perfil-stats">
          <div class="perfil-stat"><div class="perfil-stat-val">${u.puntos||0}</div><div class="perfil-stat-lbl">Puntos</div></div>
          <div class="perfil-stat"><div class="perfil-stat-val">${u.entregas_realizadas||0}</div><div class="perfil-stat-lbl">Entregas</div></div>
          <div class="perfil-stat"><div class="perfil-stat-val">${u.cursos_inscritos||0}</div><div class="perfil-stat-lbl">Cursos</div></div>
          <div class="perfil-stat"><div class="perfil-stat-val">#${u.posicion_ranking||"—"}</div><div class="perfil-stat-lbl">Ranking</div></div>
        </div>
      </div>

      <!-- Formulario de edición -->
      <div class="card" style="padding:24px">
        <h3 style="font-family:var(--font-display);margin-bottom:20px;font-size:18px">✏️ Editar perfil</h3>

        <div class="field-group" style="margin-bottom:16px">
          <label>Nombre completo</label>
          <div class="input-wrap"><input type="text" id="p-nombre" value="${escapeHtml(u.nombre)}"/></div>
        </div>

        <div class="field-group" style="margin-bottom:16px">
          <label>Biografía</label>
          <textarea id="p-bio" placeholder="Cuéntanos sobre ti..."
            style="width:100%;padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:14px;resize:vertical;min-height:80px;outline:none">${escapeHtml(u.bio || "")}</textarea>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="field-group">
            <label>Teléfono</label>
            <div class="input-wrap"><input type="tel" id="p-telefono" value="${escapeHtml(u.telefono||"")}" placeholder="809-555-0000"/></div>
          </div>
          <div class="field-group">
            <label>Fecha de nacimiento</label>
            <div class="input-wrap"><input type="date" id="p-fnac" value="${u.fecha_nacimiento ? u.fecha_nacimiento.slice(0,10) : ""}"/></div>
          </div>
        </div>

        <div class="field-group" style="margin-bottom:20px">
          <label>Color de avatar</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            ${colores.map(c => `
              <div class="color-swatch ${c===u.avatar_color?"selected":""}"
                style="background:${c}" data-color="${c}"
                onclick="selectColorPerfil(this,'${c}')"></div>`).join("")}
          </div>
          <input type="hidden" id="p-color" value="${u.avatar_color}"/>
        </div>

        <div style="display:flex;gap:12px;justify-content:flex-end">
          <button class="btn-secondary" onclick="loadPerfil()">Cancelar</button>
          <button class="btn-primary-sm" onclick="guardarPerfil()"><span>💾 Guardar cambios</span></button>
        </div>
      </div>
    </div>`;
}

function selectColorPerfil(el, color) {
  document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
  el.classList.add("selected");
  document.getElementById("p-color").value = color;
  const av = document.getElementById("perfil-avatar-display");
  if (av) av.style.background = color;
}

async function guardarPerfil() {
  const body = {
    nombre:           document.getElementById("p-nombre")?.value.trim(),
    bio:              document.getElementById("p-bio")?.value.trim(),
    telefono:         document.getElementById("p-telefono")?.value.trim(),
    fecha_nacimiento: document.getElementById("p-fnac")?.value || null,
    avatar_color:     document.getElementById("p-color")?.value,
  };
  if (!body.nombre) { showToast("El nombre no puede estar vacío.", "error"); return; }
  const data = await apiFetch("/dashboard/perfil", { method:"PUT", body:JSON.stringify(body) });
  if (data?.ok) {
    showToast("¡Perfil actualizado! ✓", "success");
    // Actualizar sesión local
    const u = data.usuario;
    usuario = { ...usuario, ...u };
    const storage = localStorage.getItem("mp_token") ? localStorage : sessionStorage;
    storage.setItem("mp_user", JSON.stringify(usuario));
    setupUI();
    loadPerfil();
  } else showToast(data?.mensaje || "Error al guardar.", "error");
}

// ============================================================
// ASISTENTE IA
// ============================================================
let chatHistorial = [];

async function loadAsistente() {
  const wrap = document.getElementById("asistente-wrap");
  if (!wrap) return;

  const tareasData = await apiFetch("/dashboard/tareas-proximas");
  const tareasPendientes = (tareasData?.tareas || [])
    .map(t => `- ${t.titulo} (vence en ${diasRestantes(t.fecha_limite)} días, +${t.puntos_valor} pts)`)
    .join("\n") || "Sin tareas pendientes";

  // Contexto del alumno para el sistema
  const systemPrompt = `Eres MindAI, el asistente inteligente de MindPath, una plataforma escolar.
Estás ayudando a ${usuario.nombre}, un estudiante con ${usuario.puntos || 0} puntos acumulados.
Sus tareas pendientes próximas son:
${tareasPendientes}

Tu rol es:
1. Ayudar al estudiante a organizar su tiempo y agenda de estudio
2. Explicar conceptos académicos de sus materias (Desarrollo Web, Bases de Datos, POO, Redes)
3. Dar consejos de productividad y estudio
4. Motivar al estudiante de forma positiva
5. Ayudar a priorizar tareas según fechas límite

Responde siempre en español, de forma amigable, clara y concisa. Usa emojis con moderación.
Si el estudiante pregunta sobre sus tareas, usa el contexto que tienes.`;

  wrap.innerHTML = `
    <div class="chat-container">
      <div class="chat-header">
        <div class="chat-avatar-ia">🤖</div>
        <div>
          <div class="chat-name">MindAI</div>
          <div class="chat-status">✨ Tu asistente de estudio personal</div>
        </div>
      </div>

      <div class="chat-messages" id="chat-messages">
        <div class="chat-msg ia">
          <div class="chat-bubble">
            ¡Hola ${escapeHtml(usuario.nombre.split(" ")[0])}! 👋 Soy <strong>MindAI</strong>, tu asistente de estudio en MindPath.<br><br>
            Puedo ayudarte a:
            <ul style="margin:8px 0 0 16px;line-height:1.8">
              <li>📅 Organizar tu agenda de estudio</li>
              <li>📚 Explicar conceptos de tus materias</li>
              <li>✅ Priorizar tus tareas pendientes</li>
              <li>💡 Darte consejos de productividad</li>
            </ul>
            <br>¿Con qué te puedo ayudar hoy?
          </div>
        </div>
        <div class="chat-sugerencias">
          <button class="chat-sug" onclick="enviarSugerencia('¿Cuáles son mis tareas más urgentes?')">📋 Mis tareas urgentes</button>
          <button class="chat-sug" onclick="enviarSugerencia('Ayúdame a crear un plan de estudio para esta semana')">🗓️ Plan de estudio</button>
          <button class="chat-sug" onclick="enviarSugerencia('¿Qué es un JOIN en SQL?')">💡 Explicar JOIN SQL</button>
          <button class="chat-sug" onclick="enviarSugerencia('Dame consejos para estudiar mejor')">🎯 Consejos de estudio</button>
        </div>
      </div>

      <div class="chat-input-area">
        <input type="text" id="chat-input" class="chat-input"
          placeholder="Escribe tu pregunta..."
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();enviarMensaje()}" />
        <button class="chat-send" onclick="enviarMensaje()" id="chat-send-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>`;

  // Guardar el system prompt para usarlo en los mensajes
  window._chatSystemPrompt = systemPrompt;
}

async function enviarMensaje() {
  const input   = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  const texto   = input?.value.trim();
  if (!texto) return;

  input.value = "";
  sendBtn.disabled = true;
  agregarMensajeChat("usuario", texto);
  chatHistorial.push({ role:"user", content:texto });

  // Indicador de escritura
  const typingId = "typing-" + Date.now();
  agregarMensajeChat("ia", `<span id="${typingId}">...</span>`, true);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: window._chatSystemPrompt || "Eres MindAI, asistente escolar. Responde en español.",
        messages: chatHistorial,
      }),
    });
    const data = await response.json();
    const respuesta = data.content?.[0]?.text || "No pude generar una respuesta. Intenta de nuevo.";

    // Reemplazar el indicador de escritura
    const typingEl = document.getElementById(typingId);
    if (typingEl) {
      typingEl.closest(".chat-msg")?.remove();
    }
    chatHistorial.push({ role:"assistant", content:respuesta });
    agregarMensajeChat("ia", respuesta);
  } catch (err) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.closest(".chat-msg")?.remove();
    agregarMensajeChat("ia", "⚠️ No pude conectar con el servidor de IA. Verifica tu conexión e intenta de nuevo.");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function enviarSugerencia(texto) {
  const input = document.getElementById("chat-input");
  if (input) { input.value = texto; enviarMensaje(); }
  // Ocultar sugerencias
  document.querySelector(".chat-sugerencias")?.remove();
}

function agregarMensajeChat(tipo, contenido, esHtml = false) {
  const msgs = document.getElementById("chat-messages");
  if (!msgs) return;
  const div  = document.createElement("div");
  div.className = `chat-msg ${tipo}`;
  // Convertir markdown básico a HTML
  let html = esHtml ? contenido : mdToHtml(contenido);
  div.innerHTML = `<div class="chat-bubble">${html}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function mdToHtml(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>")
    .replace(/^- (.+)/gm, "• $1");
}

// ============================================================
// ESTUDIANTES (admin/docente)
// ============================================================
async function loadEstudiantes(pagina = 1) {
  const wrap   = document.getElementById("estudiantes-table-wrap");
  wrap.innerHTML = `<div class="loading-state full"><div class="spinner-lg"></div></div>`;
  const buscar = document.getElementById("search-estudiantes")?.value || "";
  const data   = await apiFetch(`/estudiantes?pagina=${pagina}&limite=10&buscar=${encodeURIComponent(buscar)}`);
  const ests   = data?.estudiantes || [];
  todosLosEstudiantes = ests;
  const pag    = data?.paginacion || {};
  const esAdmin = usuario.rol === "admin";

  if (!ests.length) { wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>No se encontraron estudiantes.</p></div>`; return; }

  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Estudiante</th><th>Email</th><th>Matrícula</th><th>Puntos</th><th>Estado</th>${esAdmin?"<th>Acciones</th>":""}</tr></thead>
    <tbody>${ests.map(e => `<tr>
      <td><div class="user-cell">
        <div class="avatar-sm" style="background:${e.avatar_color}">${e.nombre.charAt(0)}</div>
        <span>${escapeHtml(e.nombre)}</span>
      </div></td>
      <td style="color:var(--text-muted)">${escapeHtml(e.email)}</td>
      <td>${e.matricula||"—"}</td>
      <td><span style="color:var(--purple)">⭐ ${e.puntos||0}</span></td>
      <td><span class="status-pill ${e.activo?"entregada":"vencida"}">${e.activo?"Activo":"Inactivo"}</span></td>
      ${esAdmin?`<td><div style="display:flex;gap:6px">
        <button class="btn-sm-action" onclick="editarEstudiante(${e.id})">✏️</button>
        <button class="btn-sm-action danger" onclick="desactivarEstudiante(${e.id},'${escapeHtml(e.nombre)}')">🗑️</button>
      </div></td>`:""}
    </tr>`).join("")}</tbody>
  </table>
  ${pag.paginas > 1 ? `<div class="pagination">
    ${pag.pagina>1?`<button class="btn-page" onclick="loadEstudiantes(${pag.pagina-1})">← Anterior</button>`:""}
    <span>Página ${pag.pagina} de ${pag.paginas} · ${pag.total} estudiantes</span>
    ${pag.pagina<pag.paginas?`<button class="btn-page" onclick="loadEstudiantes(${pag.pagina+1})">Siguiente →</button>`:""}
  </div>` : ""}`;
}

function buscarEstudiantes() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadEstudiantes(1), 350);
}

async function crearEstudiante(event) {
  event.preventDefault();
  const btn = event.target.querySelector('[type="submit"]');
  btn.disabled = true;
  const data = await apiFetch("/estudiantes", { method:"POST", body:JSON.stringify({
    nombre:   document.getElementById("new-nombre").value.trim(),
    email:    document.getElementById("new-email").value.trim(),
    matricula:document.getElementById("new-matricula").value.trim(),
    password: document.getElementById("new-password").value,
  })});
  btn.disabled = false;
  if (data?.ok) {
    showToast(data.mensaje, "success");
    closeModal("modal-nuevo-estudiante");
    document.getElementById("form-nuevo-estudiante").reset();
    loadEstudiantes();
  } else showToast(data?.mensaje || "Error.", "error");
}

async function editarEstudiante(id) {
  const est = todosLosEstudiantes.find(e => e.id === id);
  if (!est) return;
  abrirModal("modal-edit-est", `
    <div class="modal-header"><h3>✏️ Editar Estudiante</h3>
      <button class="modal-close" onclick="cerrarModal('modal-edit-est')">✕</button></div>
    <div class="modal-body">
      <div class="field-group"><label>Nombre</label>
        <div class="input-wrap"><input type="text" id="ee-nombre" value="${escapeHtml(est.nombre)}"/></div></div>
      <div class="field-group"><label>Email</label>
        <div class="input-wrap"><input type="email" id="ee-email" value="${escapeHtml(est.email)}"/></div></div>
      <div class="field-group"><label>Matrícula</label>
        <div class="input-wrap"><input type="text" id="ee-matricula" value="${est.matricula||""}"/></div></div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="cerrarModal('modal-edit-est')">Cancelar</button>
      <button class="btn-primary-sm" onclick="guardarEdicion(${id})"><span>Guardar</span></button>
    </div>`);
}

async function guardarEdicion(id) {
  const data = await apiFetch(`/estudiantes/${id}`, { method:"PUT", body:JSON.stringify({
    nombre:   document.getElementById("ee-nombre")?.value.trim(),
    email:    document.getElementById("ee-email")?.value.trim(),
    matricula:document.getElementById("ee-matricula")?.value.trim(),
  })});
  if (data?.ok) { showToast(data.mensaje,"success"); cerrarModal("modal-edit-est"); loadEstudiantes(); }
  else showToast(data?.mensaje||"Error.","error");
}

async function desactivarEstudiante(id, nombre) {
  abrirModal("modal-confirm", `
    <div class="modal-header"><h3>⚠️ Confirmar</h3>
      <button class="modal-close" onclick="cerrarModal('modal-confirm')">✕</button></div>
    <div class="modal-body"><p style="color:var(--text-muted)">
      ¿Desactivar la cuenta de <strong>${escapeHtml(nombre)}</strong>?</p></div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="cerrarModal('modal-confirm')">Cancelar</button>
      <button class="btn-danger-sm" onclick="confirmarDesactivar(${id})">Desactivar</button>
    </div>`);
}

async function confirmarDesactivar(id) {
  const data = await apiFetch(`/estudiantes/${id}`, { method:"DELETE" });
  if (data?.ok) { showToast(data.mensaje,"success"); cerrarModal("modal-confirm"); loadEstudiantes(); }
  else showToast(data?.mensaje||"Error.","error");
}

// ============================================================
// MODALES
// ============================================================
function abrirModal(id, html) {
  document.getElementById(id)?.remove();
  const m = document.createElement("div");
  m.className = "modal-overlay"; m.id = id;
  m.innerHTML = `<div class="modal">${html}</div>`;
  m.addEventListener("click", e => { if (e.target === m) cerrarModal(id); });
  document.body.appendChild(m);
  requestAnimationFrame(() => m.classList.add("visible"));
}

function cerrarModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove("visible"); setTimeout(() => m.remove(), 250); }
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove("hidden"); requestAnimationFrame(() => m.classList.add("visible")); }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove("visible"); setTimeout(() => m.classList.add("hidden"), 250); }
}

// ============================================================
// TOAST / LOGOUT / HELPERS
// ============================================================
function showToast(msg, tipo = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  document.getElementById("toast-icon").textContent = tipo === "success" ? "✓" : "✕";
  document.getElementById("toast-msg").textContent  = msg;
  toast.className = `toast ${tipo}`;
  toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.add("hidden"), 3500);
}

function logout() {
  ["mp_token","mp_user"].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
  window.location.href = "/login";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-DO", { day:"numeric", month:"short", year:"numeric" });
}

function diasRestantes(d) {
  if (!d) return 0;
  const hoy = new Date(); const f = new Date(d);
  hoy.setHours(0,0,0,0); f.setHours(0,0,0,0);
  return Math.round((f-hoy)/(1000*60*60*24));
}

function timeAgo(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), day = Math.floor(diff/86400000);
  return m<1?"ahora":m<60?`hace ${m}m`:h<24?`hace ${h}h`:`hace ${day}d`;
}
