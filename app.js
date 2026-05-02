require("dotenv").config();

const http = require("http");
const { ObjectId } = require("mongodb");
const { conectarDB } = require("./db/conexion");
const { marcarRevisada, eliminarMinuta, actualizarMinuta } = require("./routes/minutas");
const { requiereSesion, requiereSupervisor, requiereGestor } = require("./routes/middlewares");
const { manejarLogin, manejarLogout } = require("./routes/auth");
const { estilos, vistaErrorLogin, vistaLogin } = require("./views/templates");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const ExcelJS = require("exceljs");

let db;

const dbReady = conectarDB().then(database => {
  db = database;
});

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const upload = multer({ dest: "uploads/" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const usuarios = {
  jaider: { clave: "1234", nombre: "Jaider García", rol: "gestor" },
  jeferson: { clave: "1234", nombre: "Jeferson", rol: "gestor" },
  james: { clave: "1234", nombre: "James", rol: "gestor" },
  santiago: { clave: "1234", nombre: "Santiago", rol: "gestor" },
  edwin: { clave: "1234", nombre: "Edwin", rol: "gestor" },
  elmerson: { clave: "1234", nombre: "Elmerson", rol: "gestor" },
  edrian: { clave: "1234", nombre: "Edrian Alexander", rol: "gestor" },

  wilmar: { clave: "admin123", nombre: "Wilmar", rol: "supervisor" },
  jhoneider: { clave: "admin123", nombre: "Jhoneider", rol: "supervisor" },
  adreina: { clave: "admin123", nombre: "Adreina", rol: "supervisor" },
  gerencia: { clave: "admin123", nombre: "Gerencia Administrativa", rol: "supervisor" }
};

const puestos = [
  "Granja",
  "Pereira Antigua",
  "Taquilla",
  "Ronda",
  "Liceo",
  "Clínica",
  "Portería",
  "Otro"
];

const tipos = [
  "Inicio de turno",
  "Ronda",
  "Novedad",
  "Entrega de turno",
  "Emergencia",
  "Daño"
];

const sesiones = {};

function getCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};
  header.split(";").forEach(cookie => {
    const partes = cookie.trim().split("=");
    if (partes[0] && partes[1]) cookies[partes[0]] = partes[1];
  });
  return cookies;
}

function enviarHTML(res, html) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function opcionSeleccionada(valor, actual) {
  return valor === actual ? "selected" : "";
}

function fechaColombia() {
  const ahora = new Date();

  const fecha = ahora.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota"
  });

  const hora = ahora.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const fechaFiltro = ahora.toLocaleDateString("en-CA", {
    timeZone: "America/Bogota"
  });

  const mesFiltro = fechaFiltro.slice(0, 7);

  return { fecha, hora, fechaFiltro, mesFiltro };
}

function proximosDiasColombia(cantidad = 15) {
  const dias = [];
  const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));

  for (let i = 0; i < cantidad; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);

    const fecha = d.toLocaleDateString("en-CA", {
      timeZone: "America/Bogota"
    });

    const nombreDia = d.toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Bogota"
    });

    dias.push({ fecha, nombreDia });
  }

  return dias;
}

function obtenerTipoTurno() {
  const hora = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    hour12: false
  });

  const h = parseInt(hora);

  if (h >= 6 && h < 18) {
    return "Diurno ☀️";
  }

  return "Nocturno 🌙";
}

function calcularTiempoTrabajado(inicio, fin) {
  const diferenciaMs = fin - inicio;
  const minutosTotales = Math.max(0, Math.floor(diferenciaMs / (1000 * 60)));
  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  const horasDecimal = Number((minutosTotales / 60).toFixed(2));

  return {
    minutosTrabajados: minutosTotales,
    horasTrabajadas: horasDecimal,
    textoTrabajado: `${horas} hora(s) y ${minutos} minuto(s)`
  };
}

function combinarFechaHoraColombia(fecha, hora) {
  return new Date(`${fecha}T${hora}:00-05:00`);
}

function analizarCumplimientoHorario(asignacion, entradaReal, salidaReal) {
  if (!asignacion || !asignacion.horaInicioProgramada || !asignacion.horaFinProgramada) {
    return {
      estadoCumplimiento: "Sin horario programado",
      minutosTarde: 0,
      minutosSalidaTemprano: 0,
      minutosExtra: 0,
      resumenCumplimiento: "No hay horario programado para comparar."
    };
  }

  const inicioProgramado = combinarFechaHoraColombia(asignacion.fecha, asignacion.horaInicioProgramada);

  let fechaFinProgramada = asignacion.fecha;

  if (asignacion.horaFinProgramada <= asignacion.horaInicioProgramada) {
    const fechaTemp = new Date(`${asignacion.fecha}T00:00:00-05:00`);
    fechaTemp.setDate(fechaTemp.getDate() + 1);
    fechaFinProgramada = fechaTemp.toISOString().slice(0, 10);
  }

  const finProgramado = combinarFechaHoraColombia(fechaFinProgramada, asignacion.horaFinProgramada);

  const minutosTarde = Math.max(0, Math.floor((entradaReal - inicioProgramado) / 60000));
  const minutosSalidaTemprano = Math.max(0, Math.floor((finProgramado - salidaReal) / 60000));
  const minutosExtra = Math.max(0, Math.floor((salidaReal - finProgramado) / 60000));

  let estadoCumplimiento = "Cumplió horario ✅";

  if (minutosTarde > 0 && minutosSalidaTemprano > 0) {
    estadoCumplimiento = "Llegó tarde y salió antes ⚠️";
  } else if (minutosTarde > 0) {
    estadoCumplimiento = "Llegó tarde ⏰";
  } else if (minutosSalidaTemprano > 0) {
    estadoCumplimiento = "Salió antes ⚠️";
  } else if (minutosExtra > 0) {
    estadoCumplimiento = "Hizo tiempo extra 💰";
  }

  const resumenCumplimiento = `Tarde: ${minutosTarde} min | Salida antes: ${minutosSalidaTemprano} min | Extra: ${minutosExtra} min`;

  return {
    estadoCumplimiento,
    minutosTarde,
    minutosSalidaTemprano,
    minutosExtra,
    resumenCumplimiento
  };
}

function novedadSeguro(texto = "") {
  return String(texto || "").toLowerCase();
}

function detectarAlerta(novedad = "") {
  const texto = novedadSeguro(novedad);

  if (
    texto.includes("emergencia") ||
    texto.includes("robo") ||
    texto.includes("accidente") ||
    texto.includes("urgente")
  ) {
    return { clase: "alerta-roja", etiqueta: "🚨 ALERTA CRÍTICA" };
  }

  if (
    texto.includes("daño") ||
    texto.includes("problema") ||
    texto.includes("falla")
  ) {
    return { clase: "alerta-amarilla", etiqueta: "⚠️ Atención" };
  }

  return { clase: "", etiqueta: "" };
}

// ─── NUEVA FUNCIÓN: HTML de ubicación para supervisor ───────────────────────
function htmlUbicacion(ubicacion, etiqueta = "Ubicación") {
  if (!ubicacion || !ubicacion.lat || ubicacion.lat === 0) {
    return `<p><b>📍 ${etiqueta}:</b> <span style="color:#94a3b8;">No disponible</span></p>`;
  }

  const lat = parseFloat(ubicacion.lat).toFixed(6);
  const lng = parseFloat(ubicacion.lng).toFixed(6);
  const precision = Math.round(ubicacion.precision || 0);
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  const timestamp = ubicacion.timestamp
    ? new Date(ubicacion.timestamp).toLocaleString("es-CO", { timeZone: "America/Bogota" })
    : "";

  return `
    <div style="
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 10px;
      padding: 10px 14px;
      margin: 8px 0;
      font-size: 13px;
    ">
      <p style="margin:0 0 4px 0;"><b>📍 ${etiqueta}</b></p>
      <p style="margin:0 0 4px 0; color:#374151;">
        🌐 <b>Coordenadas:</b> ${lat}, ${lng}
        &nbsp;|&nbsp; 🎯 <b>Precisión:</b> ±${precision}m
      </p>
      ${timestamp ? `<p style="margin:0 0 6px 0; color:#6b7280;">🕒 ${timestamp}</p>` : ""}
      <a
        href="${url}"
        target="_blank"
        style="
          display: inline-block;
          background: #16a34a;
          color: white;
          padding: 6px 14px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 13px;
        "
      >
        📌 Ver en Google Maps
      </a>
    </div>
  `;
}
// ─────────────────────────────────────────────────────────────────────────────

async function obtenerMinutasFiltradas(url, sesion) {
  let minutas = await db.collection("minutas").find().toArray();

  const filtroPuesto = url.searchParams.get("puesto") || "";
  const filtroGestor = url.searchParams.get("gestor") || "";
  const filtroTipo = url.searchParams.get("tipo") || "";
  const filtroFecha = url.searchParams.get("fecha") || "";

  if (sesion && sesion.rol === "gestor") {
    minutas = minutas.filter(m => m.usuario === sesion.usuario);
  }

  if (sesion && sesion.rol === "supervisor") {
    if (filtroPuesto) minutas = minutas.filter(m => m.puesto === filtroPuesto);
    if (filtroGestor) minutas = minutas.filter(m => m.gestor === filtroGestor);
    if (filtroTipo) minutas = minutas.filter(m => m.tipo === filtroTipo);

    if (filtroFecha) {
      minutas = minutas.filter(m => {
        if (m.fechaFiltro) return m.fechaFiltro === filtroFecha;
        return m.fecha && m.fecha.includes(filtroFecha);
      });
    }
  }

  return minutas;
}


// ─── SCRIPT DE GEOLOCALIZACIÓN (se inyecta en /app) ─────────────────────────
const scriptUbicacion = `
<script>
  // ── Normalizar IDs ──
  function normalizarId(texto) {
    return String(texto)
      .replace(/\\s+/g, "-")
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ-]/g, "");
  }

  // ── Toggles ──
  function toggleGrupoMinutas(puesto) {
    const id = "grupo-minutas-" + normalizarId(puesto);
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === "none" ? "block" : "none";
  }

  function toggleTurnos(id) {
    const el = document.getElementById("grupo-turnos-" + id);
    if (!el) return;
    el.style.display = el.style.display === "none" ? "block" : "none";
  }

  function toggleProgramacion(id) {
    const el = document.getElementById("grupo-programacion-" + id);
    if (!el) return;
    el.style.display = el.style.display === "none" ? "block" : "none";
  }

  function toggleHistorial(id) {
    const el = document.getElementById("historial-" + id);
    if (!el) {
      alert("No encontré el historial de esta asignación");
      return;
    }
    el.style.display = (el.style.display === "none" || el.style.display === "")
      ? "block" : "none";
  }

  // ── Geolocalización ──────────────────────────────────────────────────────
  function obtenerUbicacion(callback) {
    if (!navigator.geolocation) {
      alert("⚠️ Tu dispositivo no soporta geolocalización. No puedes continuar sin ubicación.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function(pos) {
        callback({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: pos.coords.accuracy
        });
      },
      function(error) {
        let msg = "⚠️ Debes permitir el acceso a tu ubicación para continuar.";
        if (error.code === error.TIMEOUT) msg = "⏱️ Tiempo de espera agotado. Intenta de nuevo.";
        if (error.code === error.POSITION_UNAVAILABLE) msg = "📡 Ubicación no disponible. Verifica tu GPS.";
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function enviarConUbicacion(formId, btnId) {
    const form = document.getElementById(formId);
    const btn = document.getElementById(btnId);

    if (!form) return;

    // Mostrar spinner en el botón
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Obteniendo ubicación...';
    }

    obtenerUbicacion(function(coords) {
      form.querySelector('[name="lat"]').value = coords.lat;
      form.querySelector('[name="lng"]').value = coords.lng;
      form.querySelector('[name="precision"]').value = coords.precision;
      form.submit();
    });

    // Si el usuario tarda mucho o niega, restaurar botón después de 16s
    setTimeout(function() {
      if (btn && btn.disabled) {
        btn.disabled = false;
        btn.innerHTML = btn.getAttribute("data-texto-original") || "Intentar de nuevo";
      }
    }, 16000);
  }
</script>
`;
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  await dbReady;

  const cookies = getCookies(req);
  const sessionId = cookies.sessionId;
  const sesion = sesiones[sessionId];

  if (req.url.startsWith("/exportar-excel")) {
    if (!requiereSupervisor(sesion, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const minutas = await obtenerMinutasFiltradas(url, sesion);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Minutas");

    worksheet.columns = [
      { header: "Fecha", key: "fecha", width: 18 },
      { header: "Hora", key: "hora", width: 18 },
      { header: "Gestor", key: "gestor", width: 22 },
      { header: "Puesto", key: "puesto", width: 25 },
      { header: "Tipo", key: "tipo", width: 20 },
      { header: "Estado", key: "estado", width: 18 },
      { header: "Novedad", key: "novedad", width: 50 },
      { header: "Foto", key: "foto", width: 55 },
      { header: "Latitud", key: "lat", width: 18 },
      { header: "Longitud", key: "lng", width: 18 },
      { header: "Precisión (m)", key: "precision", width: 18 },
      { header: "Enlace Google Maps", key: "mapsUrl", width: 55 }
    ];

    minutas.forEach(m => {
      const lat = m.ubicacion && m.ubicacion.lat ? m.ubicacion.lat : "";
      const lng = m.ubicacion && m.ubicacion.lng ? m.ubicacion.lng : "";
      const precision = m.ubicacion && m.ubicacion.precision ? Math.round(m.ubicacion.precision) : "";
      const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : "";

      worksheet.addRow({
        ...m,
        estado: m.estado || "Pendiente",
        lat,
        lng,
        precision,
        mapsUrl
      });
    });

    res.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=minutas.xlsx"
    });

    await workbook.xlsx.write(res);
    res.end();
    return;
  }

  if (req.url.startsWith("/exportar-programacion-excel")) {
  if (!requiereSupervisor(sesion, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const usuarioFiltro = url.searchParams.get("usuario") || "";

    const diasProgramacion = proximosDiasColombia(15);
    const fechasProgramacion = diasProgramacion.map(d => d.fecha);

    const filtro = {
      fecha: { $in: fechasProgramacion }
    };

    if (usuarioFiltro) {
      filtro.usuario = usuarioFiltro;
    }

    const asignaciones = await db.collection("asignaciones")
      .find(filtro)
      .sort({ gestor: 1, fecha: 1 })
      .toArray();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Programacion");

    worksheet.columns = [
      { header: "Fecha", key: "fecha", width: 15 },
      { header: "Gestor", key: "gestor", width: 25 },
      { header: "Puesto", key: "puesto", width: 22 },
      { header: "Hora inicio", key: "horaInicioProgramada", width: 18 },
      { header: "Hora fin", key: "horaFinProgramada", width: 18 },
      { header: "Tipo de día", key: "tipoDia", width: 18 },
      { header: "Motivo", key: "motivo", width: 35 },
      { header: "Emergencia", key: "emergencia", width: 15 },
      { header: "Actualizado por", key: "actualizadoPor", width: 22 }
    ];

    asignaciones.forEach(a => {
      worksheet.addRow({
        fecha: a.fecha || "",
        gestor: a.gestor || "",
        puesto: a.puesto || "",
        horaInicioProgramada: a.tipoDia === "Descanso" ? "Descanso" : (a.horaInicioProgramada || ""),
        horaFinProgramada: a.tipoDia === "Descanso" ? "Descanso" : (a.horaFinProgramada || ""),
        tipoDia: a.tipoDia || "Turno",
        motivo: a.motivo || "",
        emergencia: a.esEmergencia ? "Sí" : "No",
        actualizadoPor: a.actualizadoPor || ""
      });
    });

    res.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=programacion.xlsx"
    });

    await workbook.xlsx.write(res);
    res.end();
    return;
  }

  if (req.url.startsWith("/exportar-turnos-excel")) {
    if (!requiereSupervisor(sesion, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const gestorFiltro = url.searchParams.get("gestor") || "";

    const filtro = { estado: "Cerrado" };

    if (gestorFiltro) {
      filtro.gestor = gestorFiltro;
    }

    const turnos = await db.collection("turnos")
      .find(filtro)
      .sort({ cerradoEn: -1 })
      .toArray();

    const totalHoras = turnos.reduce((acc, t) => acc + (Number(t.horasTrabajadas) || 0), 0);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Turnos cerrados");

    worksheet.columns = [
      { header: "Gestor", key: "gestor", width: 25 },
      { header: "Puesto", key: "puesto", width: 22 },
      { header: "Fecha entrada", key: "fecha", width: 18 },
      { header: "Hora entrada", key: "horaEntrada", width: 18 },
      { header: "Fecha salida", key: "fechaSalida", width: 18 },
      { header: "Hora salida", key: "horaSalida", width: 18 },
      { header: "Tiempo trabajado", key: "tiempoTrabajado", width: 25 },
      { header: "Horas trabajadas", key: "horasTrabajadas", width: 18 },
      { header: "Horario programado", key: "horarioProgramado", width: 25 },
      { header: "Cumplimiento", key: "estadoCumplimiento", width: 30 },
      { header: "Detalle", key: "resumenCumplimiento", width: 40 },
      { header: "Lat. Entrada", key: "latEntrada", width: 18 },
      { header: "Lng. Entrada", key: "lngEntrada", width: 18 },
      { header: "Maps Entrada", key: "mapsEntrada", width: 55 },
      { header: "Lat. Salida", key: "latSalida", width: 18 },
      { header: "Lng. Salida", key: "lngSalida", width: 18 },
      { header: "Maps Salida", key: "mapsSalida", width: 55 }
    ];

    turnos.forEach(t => {
      const latE = t.ubicacionEntrada && t.ubicacionEntrada.lat ? t.ubicacionEntrada.lat : "";
      const lngE = t.ubicacionEntrada && t.ubicacionEntrada.lng ? t.ubicacionEntrada.lng : "";
      const latS = t.ubicacionSalida && t.ubicacionSalida.lat ? t.ubicacionSalida.lat : "";
      const lngS = t.ubicacionSalida && t.ubicacionSalida.lng ? t.ubicacionSalida.lng : "";

      worksheet.addRow({
        gestor: t.gestor || "",
        puesto: t.puesto || "",
        fecha: t.fecha || "",
        horaEntrada: t.horaEntrada || "",
        fechaSalida: t.fechaSalida || "",
        horaSalida: t.horaSalida || "",
        tiempoTrabajado: t.tiempoTrabajado || "",
        horasTrabajadas: Number(t.horasTrabajadas || 0),
        horarioProgramado: t.horarioProgramado || "Sin horario",
        estadoCumplimiento: t.estadoCumplimiento || "No analizado",
        resumenCumplimiento: t.resumenCumplimiento || "",
        latEntrada: latE,
        lngEntrada: lngE,
        mapsEntrada: latE && lngE ? `https://www.google.com/maps?q=${latE},${lngE}` : "",
        latSalida: latS,
        lngSalida: lngS,
        mapsSalida: latS && lngS ? `https://www.google.com/maps?q=${latS},${lngS}` : ""
      });
    });

    worksheet.addRow({});
    worksheet.addRow({
      gestor: "TOTAL HORAS",
      horasTrabajadas: Number(totalHoras.toFixed(2))
    });

    res.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=turnos-cerrados.xlsx"
    });

    await workbook.xlsx.write(res);
    res.end();
    return;
  }

  if (req.url.startsWith("/exportar-turnos-pdf")) {
    if (!requiereSupervisor(sesion, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const gestorFiltro = url.searchParams.get("gestor") || "";

    const filtro = { estado: "Cerrado" };

    if (gestorFiltro) {
      filtro.gestor = gestorFiltro;
    }

    const turnos = await db.collection("turnos")
      .find(filtro)
      .sort({ cerradoEn: -1 })
      .toArray();

    const totalHoras = turnos.reduce((acc, t) => acc + (Number(t.horasTrabajadas) || 0), 0);

    const titulo = gestorFiltro
      ? `Turnos cerrados de ${gestorFiltro}`
      : "Turnos cerrados generales";

    const filas = turnos.map(t => {
      const latE = t.ubicacionEntrada && t.ubicacionEntrada.lat ? parseFloat(t.ubicacionEntrada.lat).toFixed(6) : "";
      const lngE = t.ubicacionEntrada && t.ubicacionEntrada.lng ? parseFloat(t.ubicacionEntrada.lng).toFixed(6) : "";
      const latS = t.ubicacionSalida && t.ubicacionSalida.lat ? parseFloat(t.ubicacionSalida.lat).toFixed(6) : "";
      const lngS = t.ubicacionSalida && t.ubicacionSalida.lng ? parseFloat(t.ubicacionSalida.lng).toFixed(6) : "";

      const mapsEntrada = latE && lngE
        ? `<a href="https://www.google.com/maps?q=${latE},${lngE}" target="_blank">📌 Ver entrada</a>`
        : "Sin ubicación";

      const mapsSalida = latS && lngS
        ? `<a href="https://www.google.com/maps?q=${latS},${lngS}" target="_blank">📌 Ver salida</a>`
        : "Sin ubicación";

      return `
        <tr>
          <td>${t.gestor || ""}</td>
          <td>${t.puesto || ""}</td>
          <td>${t.fecha || ""} - ${t.horaEntrada || ""}</td>
          <td>${t.fechaSalida || ""} - ${t.horaSalida || ""}</td>
          <td>${t.tiempoTrabajado || ""}</td>
          <td>${Number(t.horasTrabajadas || 0).toFixed(2)}</td>
          <td>${t.estadoCumplimiento || "No analizado"}</td>
          <td>${mapsEntrada}</td>
          <td>${mapsSalida}</td>
        </tr>
      `;
    }).join("");

    enviarHTML(res, `
      <html>
      <head>
        <title>${titulo}</title>
        ${estilos}
        <style>
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 7px; text-align: left; }
          th { background: #eaf3ff; color: #005baa; }
        </style>
      </head>
      <body>
        <div class="contenedor">
          <h1>${titulo}</h1>
          <p><b>Total turnos:</b> ${turnos.length}</p>
          <p><b>Total horas trabajadas:</b> ${totalHoras.toFixed(2)} horas</p>
          <button onclick="window.print()">📄 Descargar / Imprimir PDF</button>
          ${
            turnos.length === 0
              ? "<p>No hay turnos cerrados para exportar.</p>"
              : `
                <table>
                  <tr>
                    <th>Gestor</th><th>Puesto</th><th>Entrada</th><th>Salida</th>
                    <th>Tiempo</th><th>Horas</th><th>Cumplimiento</th>
                    <th>Ubicación entrada</th><th>Ubicación salida</th>
                  </tr>
                  ${filas}
                </table>
              `
          }
          <br><a href="/app">⬅ Volver</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (req.url.startsWith("/exportar-programacion-pdf")) {
   if (!requiereSupervisor(sesion, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const usuarioFiltro = url.searchParams.get("usuario") || "";

    const diasProgramacion = proximosDiasColombia(15);
    const fechasProgramacion = diasProgramacion.map(d => d.fecha);

    const filtro = { fecha: { $in: fechasProgramacion } };
    if (usuarioFiltro) filtro.usuario = usuarioFiltro;

    const asignaciones = await db.collection("asignaciones")
      .find(filtro)
      .sort({ gestor: 1, fecha: 1 })
      .toArray();

    const titulo = usuarioFiltro && usuarios[usuarioFiltro]
      ? `Programación de ${usuarios[usuarioFiltro].nombre}`
      : "Programación general próximos 15 días";

    const filas = asignaciones.map(a => `
      <tr>
        <td>${a.fecha || ""}</td>
        <td>${a.gestor || ""}</td>
        <td>${a.puesto || ""}</td>
        <td>${a.tipoDia === "Descanso" ? "Descanso" : `${a.horaInicioProgramada || ""} - ${a.horaFinProgramada || ""}`}</td>
        <td>${a.tipoDia || "Turno"}</td>
        <td>${a.motivo || ""}</td>
        <td>${a.esEmergencia ? "Sí" : "No"}</td>
      </tr>
    `).join("");

    enviarHTML(res, `
      <html>
      <head>
        <title>${titulo}</title>
        ${estilos}
        <style>
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #eaf3ff; color: #005baa; }
        </style>
      </head>
      <body>
        <div class="contenedor">
          <h1>${titulo}</h1>
          <p>Total registros: ${asignaciones.length}</p>
          <button onclick="window.print()">📄 Descargar / Imprimir PDF</button>
          ${
            asignaciones.length === 0
              ? "<p>No hay programación para exportar.</p>"
              : `
                <table>
                  <tr>
                    <th>Fecha</th><th>Gestor</th><th>Puesto</th>
                    <th>Horario</th><th>Tipo</th><th>Motivo</th><th>Emergencia</th>
                  </tr>
                  ${filas}
                </table>
              `
          }
          <br><a href="/app">⬅ Volver</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (req.url.startsWith("/exportar-pdf")) {
    if (!requiereSupervisor(sesion, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const minutas = await obtenerMinutasFiltradas(url, sesion);

    const contenido = (() => {
      const minutasPorPuesto = {};
      minutas.forEach(m => {
        if (!minutasPorPuesto[m.puesto]) minutasPorPuesto[m.puesto] = [];
        minutasPorPuesto[m.puesto].push(m);
      });

      return Object.keys(minutasPorPuesto).map(puesto => `
        <div class="card">
          <h3>${puesto}</h3>
          ${
            minutasPorPuesto[puesto]
              .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
              .map(m => {
                const lat = m.ubicacion && m.ubicacion.lat ? parseFloat(m.ubicacion.lat).toFixed(6) : "";
                const lng = m.ubicacion && m.ubicacion.lng ? parseFloat(m.ubicacion.lng).toFixed(6) : "";
                const mapsLink = lat && lng
                  ? `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank">📌 Ver en Google Maps</a>`
                  : "Sin ubicación";

                return `
                  <div class="turno-card">
                    <p><b>${m.gestor || ""}</b></p>
                    <p>${m.novedad || ""}</p>
                    <p>${m.fecha || ""}</p>
                    <p><b>📍 Ubicación:</b> ${lat && lng ? `${lat}, ${lng} | ` : ""}${mapsLink}</p>
                  </div>
                `;
              }).join("")
          }
        </div>
      `).join("");
    })();

    enviarHTML(res, `
      <html>
      <head>
        <title>Reporte de Minutas</title>
        ${estilos}
      </head>
      <body>
        <div class="contenedor">
          <h1>Reporte de Minutas</h1>
          <p>Total de registros: ${minutas.length}</p>
          <button onclick="window.print()">📄 Descargar / Imprimir PDF</button>
          ${contenido || "<p>No hay minutas para este reporte.</p>"}
        </div>
      </body>
      </html>
    `);
    return;
  }

  // ─── POST: guardar minuta (con multer + ubicación) ───────────────────────
  if (req.method === "POST" && req.url === "/guardar") {
    if (!requiereGestor(sesion, res)) return;

    upload.single("foto")(req, res, async err => {
      if (err) {
        enviarHTML(res, `<h1>Error subiendo foto ❌</h1><a href="/app">Volver</a>`);
        return;
      }

      let fotoUrl = "";

      try {
        if (req.file) {
          const resultado = await cloudinary.uploader.upload(req.file.path, {
            folder: "minutas-consota"
          });
          fotoUrl = resultado.secure_url;
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        }

        const { fecha, hora, fechaFiltro } = fechaColombia();

        // Capturar ubicación enviada desde el frontend
        const lat = parseFloat(req.body.lat || 0);
        const lng = parseFloat(req.body.lng || 0);
        const precision = parseFloat(req.body.precision || 0);

        const minuta = {
          fecha,
          hora,
          fechaFiltro,
          usuario: sesion.usuario,
          gestor: sesion.nombre,
          puesto: req.body.puesto,
          tipo: req.body.tipo,
          novedad: req.body.novedad,
          estado: "Pendiente",
          foto: fotoUrl,
          // ── NUEVA UBICACIÓN ──
          ubicacion: {
            lat: lat || null,
            lng: lng || null,
            precision: precision || null,
            timestamp: new Date()
          }
        };

        await db.collection("minutas").insertOne(minuta);

        res.writeHead(302, { Location: "/app" });
        res.end();
      } catch (error) {
        console.error("Error guardando minuta:", error);
        enviarHTML(res, `<h1>Error guardando la minuta ❌</h1><a href="/app">Volver</a>`);
      }
    });

    return;
  }

  // ─── POST: iniciar turno (con ubicación) ─────────────────────────────────
  if (req.method === "POST" && req.url === "/iniciar-turno") {
   if (!requiereGestor(sesion, res)) return;

    let datos = "";
    req.on("data", parte => datos += parte);

    req.on("end", async () => {
      const form = new URLSearchParams(datos);
      const puesto = form.get("puesto");
      const { fecha, hora, fechaFiltro } = fechaColombia();

      // Capturar ubicación
      const lat = parseFloat(form.get("lat") || 0);
      const lng = parseFloat(form.get("lng") || 0);
      const precision = parseFloat(form.get("precision") || 0);

      const turnoActivo = await db.collection("turnos").findOne({
        usuario: sesion.usuario,
        estado: "Activo"
      });

      if (turnoActivo) {
        res.writeHead(302, { Location: "/app" });
        res.end();
        return;
      }

      const asignacionHoyTurno = await db.collection("asignaciones").findOne({
        usuario: sesion.usuario,
        fecha: fechaFiltro
      });

      if (!asignacionHoyTurno) {
        enviarHTML(res, `
          <html><head>${estilos}</head>
          <body><div class="contenedor">
            <div class="card alerta-roja">
              <h2>🚫 No puedes iniciar turno</h2>
              <p>No tienes programación asignada para hoy.</p>
              <a class="btn" href="/app">⬅ Volver</a>
            </div>
          </div></body></html>
        `);
        return;
      }

      if ((asignacionHoyTurno.tipoDia || "Turno") !== "Turno") {
        enviarHTML(res, `
          <html><head>${estilos}</head>
          <body><div class="contenedor">
            <div class="card alerta-roja">
              <h2>🚫 No puedes iniciar turno</h2>
              <p>Hoy estás registrado como: <b>${asignacionHoyTurno.tipoDia}</b>.</p>
              <a class="btn" href="/app">⬅ Volver</a>
            </div>
          </div></body></html>
        `);
        return;
      }

      if (asignacionHoyTurno.puesto !== puesto) {
        enviarHTML(res, `
          <html><head>${estilos}</head>
          <body><div class="contenedor">
            <div class="card alerta-roja">
              <h2>🚫 Puesto incorrecto</h2>
              <p>Hoy estás asignado a: <b>${asignacionHoyTurno.puesto}</b></p>
              <p>No puedes iniciar turno en: <b>${puesto}</b></p>
              <a class="btn" href="/app">⬅ Volver</a>
            </div>
          </div></body></html>
        `);
        return;
      }

      const turno = {
        gestor: sesion.nombre,
        usuario: sesion.usuario,
        puesto,
        fecha,
        fechaFiltro,
        horaEntrada: hora,
        tipoTurno: obtenerTipoTurno(),
        estado: "Activo",
        asignacionId: asignacionHoyTurno._id,
        creadoEn: new Date(),
        // ── NUEVA UBICACIÓN DE ENTRADA ──
        ubicacionEntrada: {
          lat: lat || null,
          lng: lng || null,
          precision: precision || null,
          timestamp: new Date()
        }
      };

      await db.collection("turnos").insertOne(turno);

      res.writeHead(302, { Location: "/app" });
      res.end();
    });

    return;
  }

  // ─── POST: cerrar turno (con ubicación) ──────────────────────────────────
  if (req.method === "POST" && req.url === "/cerrar-turno") {
    if (!requiereGestor(sesion, res)) return;

    let datos = "";
    req.on("data", parte => datos += parte);

    req.on("end", async () => {
      const form = new URLSearchParams(datos);

      // Capturar ubicación de salida
      const lat = parseFloat(form.get("lat") || 0);
      const lng = parseFloat(form.get("lng") || 0);
      const precision = parseFloat(form.get("precision") || 0);

      const turnoActivo = await db.collection("turnos").findOne({
        usuario: sesion.usuario,
        estado: "Activo"
      });

      if (!turnoActivo) {
        res.writeHead(302, { Location: "/app" });
        res.end();
        return;
      }

      const { fecha, hora, fechaFiltro } = fechaColombia();

      const entrada = turnoActivo.creadoEn ? new Date(turnoActivo.creadoEn) : new Date();
      const salida = new Date();
      const tiempo = calcularTiempoTrabajado(entrada, salida);

      const asignacionTurno = await db.collection("asignaciones").findOne({
        usuario: sesion.usuario,
        fecha: turnoActivo.fechaFiltro
      });

      const cumplimiento = analizarCumplimientoHorario(asignacionTurno, entrada, salida);

      await db.collection("turnos").updateOne(
        { _id: turnoActivo._id },
        {
          $set: {
            fechaSalida: fecha,
            fechaSalidaFiltro: fechaFiltro,
            horaSalida: hora,
            estado: "Cerrado",
            cerradoEn: salida,
            minutosTrabajados: tiempo.minutosTrabajados,
            horasTrabajadas: tiempo.horasTrabajadas,
            tiempoTrabajado: tiempo.textoTrabajado,
            estadoCumplimiento: cumplimiento.estadoCumplimiento,
            minutosTarde: cumplimiento.minutosTarde,
            minutosSalidaTemprano: cumplimiento.minutosSalidaTemprano,
            minutosExtra: cumplimiento.minutosExtra,
            resumenCumplimiento: cumplimiento.resumenCumplimiento,
            horarioProgramado: asignacionTurno
              ? `${asignacionTurno.horaInicioProgramada || ""} - ${asignacionTurno.horaFinProgramada || ""}`
              : "Sin horario",
            // ── NUEVA UBICACIÓN DE SALIDA ──
            ubicacionSalida: {
              lat: lat || null,
              lng: lng || null,
              precision: precision || null,
              timestamp: new Date()
            }
          }
        }
      );

      res.writeHead(302, { Location: "/app" });
      res.end();
    });

    return;
  }

  if (req.method === "POST") {
    let datos = "";
    req.on("data", parte => datos += parte);

    req.on("end", async () => {
      const form = new URLSearchParams(datos);
      const accion = form.get("accion");

     if (accion === "login") {
    manejarLogin(form, res, {
        usuarios,
        sesiones,
        enviarHTML,
        vistaErrorLogin,
        estilos,
        crypto
    });
    return;
}

if (accion === "revisada") {
  if (!requiereSupervisor(sesion, res)) return;

  await marcarRevisada(form, db, sesion, res);
  return;
}

      if (accion === "asignar") {
        if (!requiereSupervisor(sesion, res)) return;

        const usuario = form.get("usuario");
        const puesto = form.get("puesto");
        const fecha = form.get("fecha");
        const horaInicioProgramada = form.get("horaInicioProgramada");
        const horaFinProgramada = form.get("horaFinProgramada");
        const tipoDia = form.get("tipoDia") || "Turno";
        const motivo = form.get("motivo") || "Asignación normal";
        const emergencia = form.get("emergencia") === "si";

        if (!usuarios[usuario] || usuarios[usuario].rol !== "gestor") {
          res.writeHead(302, { Location: "/app" });
          res.end();
          return;
        }

        const gestor = usuarios[usuario].nombre;
        const asignacionAnterior = await db.collection("asignaciones").findOne({ usuario, fecha });

        const auditoria = {
          accion: asignacionAnterior ? "Actualizó asignación" : "Creó asignación",
          usuarioAccion: sesion.usuario,
          nombreAccion: sesion.nombre,
          rolAccion: sesion.rol,
          fechaAccion: new Date(),
          cambios: { gestor, puesto, fecha, horaInicioProgramada, horaFinProgramada, tipoDia, motivo, esEmergencia: emergencia }
        };

        await db.collection("asignaciones").updateOne(
          { usuario, fecha },
          {
            $set: { gestor, usuario, puesto, fecha, horaInicioProgramada, horaFinProgramada, tipoDia, motivo, esEmergencia: emergencia, actualizadoPor: sesion.nombre, actualizadoEn: new Date() },
            $push: { historialCambios: auditoria },
            $setOnInsert: { creadoPor: sesion.nombre, creadoPorUsuario: sesion.usuario, creadoEn: new Date() }
          },
          { upsert: true }
        );

        res.writeHead(302, { Location: "/app" });
        res.end();
        return;
      }

      if (accion === "eliminar_turno") {
        if (!requiereSupervisor(sesion, res)) return;

        const id = form.get("id");
        await db.collection("turnos").deleteOne({ _id: new ObjectId(id), estado: "Cerrado" });

        res.writeHead(302, { Location: "/app" });
        res.end();
        return;
      }

      if (accion === "eliminar_asignacion") {
        if (!requiereSupervisor(sesion, res)) return;

        const id = form.get("id");
        await db.collection("asignaciones").deleteOne({ _id: new ObjectId(id) });

        res.writeHead(302, { Location: "/app" });
        res.end();
        return;
      }

      if (accion === "actualizar_asignacion") {
        if (!requiereSupervisor(sesion, res)) return;

        const id = form.get("id");
        const usuario = form.get("usuario");
        const puesto = form.get("puesto");
        const fecha = form.get("fecha");
        const horaInicioProgramada = form.get("horaInicioProgramada");
        const horaFinProgramada = form.get("horaFinProgramada");
        const tipoDia = form.get("tipoDia") || "Turno";
        const motivo = form.get("motivo") || "Actualización de asignación";
        const emergencia = form.get("emergencia") === "si";

        if (!usuarios[usuario] || usuarios[usuario].rol !== "gestor") {
          res.writeHead(302, { Location: "/app" });
          res.end();
          return;
        }

        const asignacionAnterior = await db.collection("asignaciones").findOne({ _id: new ObjectId(id) });

        const auditoria = {
          accion: "Editó asignación",
          usuarioAccion: sesion.usuario,
          nombreAccion: sesion.nombre,
          rolAccion: sesion.rol,
          fechaAccion: new Date(),
          antes: asignacionAnterior || null,
          cambios: { usuario, gestor: usuarios[usuario].nombre, puesto, fecha, horaInicioProgramada, horaFinProgramada, tipoDia, motivo, esEmergencia: emergencia }
        };

        await db.collection("asignaciones").updateOne(
          { _id: new ObjectId(id) },
          {
            $set: { usuario, gestor: usuarios[usuario].nombre, puesto, fecha, horaInicioProgramada, horaFinProgramada, tipoDia, motivo, esEmergencia: emergencia, actualizadoPor: sesion.nombre, actualizadoEn: new Date() },
            $push: { historialCambios: auditoria }
          }
        );

        res.writeHead(302, { Location: "/app" });
        res.end();
        return;
      }

      if (accion === "generar_rango") {
        if (!requiereSupervisor(sesion, res)) return;

        const usuario = form.get("usuario");
        const puesto = form.get("puesto");
        const fechaInicio = form.get("fechaInicio");
        const fechaFin = form.get("fechaFin");
        const motivo = form.get("motivo") || "Programación por rango";

        if (!usuario || !fechaInicio || !fechaFin) {
          res.writeHead(302, { Location: "/programar-rango" });
          res.end();
          return;
        }

        const dias = [];
        const inicio = new Date(fechaInicio + "T00:00:00");
        const fin = new Date(fechaFin + "T00:00:00");

        while (inicio <= fin) {
          dias.push(inicio.toISOString().slice(0, 10));
          inicio.setDate(inicio.getDate() + 1);
        }

        enviarHTML(res, `
          <html>
          <head><title>Editar programación</title>${estilos}</head>
          <body>
            <header><div class="logo">CF</div><h1>🛠️ Configurar días</h1></header>
            <div class="contenedor">
              <form method="POST">
                <input type="hidden" name="accion" value="guardar_rango">
                <input type="hidden" name="usuario" value="${usuario}">
                <input type="hidden" name="puesto" value="${puesto}">
                <input type="hidden" name="motivo" value="${motivo}">
                ${dias.map((fecha, i) => `
                  <div class="card">
                    <h3>${fecha}</h3>
                    <label>Tipo de día</label>
                    <select name="tipoDia_${i}">
                      <option value="Turno">Turno</option>
                      <option value="Descanso">Descanso</option>
                      <option value="Disponible">Disponible</option>
                    </select>
                    <label>Hora inicio</label>
                    <input type="time" name="inicio_${i}">
                    <label>Hora fin</label>
                    <input type="time" name="fin_${i}">
                    <input type="hidden" name="fecha_${i}" value="${fecha}">
                  </div>
                `).join("")}
                <input type="hidden" name="totalDias" value="${dias.length}">
                <button type="submit">💾 Guardar programación completa</button>
              </form>
              <a href="/app">⬅ Volver</a>
            </div>
          </body>
          </html>
        `);
        return;
      }

      if (accion === "guardar_rango") {
        if (!requiereSupervisor(sesion, res)) return;

        const usuario = form.get("usuario");
        const puesto = form.get("puesto");
        const motivo = form.get("motivo") || "Programación por rango";
        const totalDias = parseInt(form.get("totalDias") || "0");

        if (!usuario || totalDias <= 0) {
          res.writeHead(302, { Location: "/app" });
          res.end();
          return;
        }

        const gestor = usuarios[usuario].nombre;

        for (let i = 0; i < totalDias; i++) {
          const fecha = form.get(`fecha_${i}`);
          const tipoDia = form.get(`tipoDia_${i}`) || "Turno";
          const inicio = form.get(`inicio_${i}`);
          const fin = form.get(`fin_${i}`);

          await db.collection("asignaciones").updateOne(
            { usuario, fecha },
            {
              $set: { usuario, gestor, puesto, fecha, horaInicioProgramada: inicio, horaFinProgramada: fin, tipoDia, motivo, esEmergencia: false, actualizadoPor: sesion.nombre, actualizadoEn: new Date() }
            },
            { upsert: true }
          );
        }

        res.writeHead(302, { Location: "/app" });
        res.end();
        return;
      }

      if (accion === "eliminar") {
  if (!requiereSupervisor(sesion, res)) return;

  await eliminarMinuta(form, db, res);
  return;
}

      if (accion === "actualizar") {
  if (!requiereSupervisor(sesion, res)) return;

  await actualizarMinuta(form, db, res);
  return;
}

      res.writeHead(302, { Location: "/app" });
      res.end();
    });

    return;
  }

  if (req.url === "/logout") {
  manejarLogout(req, res, { sesiones });
  return;
}

  if (req.url.startsWith("/editar-asignacion")) {
   if (!requiereSupervisor(sesion, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get("id");
    const asignacion = await db.collection("asignaciones").findOne({ _id: new ObjectId(id) });

    if (!asignacion) {
      enviarHTML(res, `<h1>Asignación no encontrada</h1><a href="/app">Volver</a>`);
      return;
    }

    enviarHTML(res, `
      <html>
      <head><title>Editar asignación</title>${estilos}</head>
      <body>
        <header><div class="logo">CF</div><h1>Editar asignación</h1></header>
        <div class="contenedor">
          <form method="POST">
            <input type="hidden" name="accion" value="actualizar_asignacion">
            <input type="hidden" name="id" value="${id}">
            <label>Gestor</label>
            <select name="usuario" required>
              ${Object.entries(usuarios).filter(([u, d]) => d.rol === "gestor").map(([u, d]) => `
                <option value="${u}" ${opcionSeleccionada(u, asignacion.usuario)}>${d.nombre}</option>
              `).join("")}
            </select>
            <label>Puesto</label>
            <select name="puesto" required>
              ${puestos.map(p => `<option value="${p}" ${opcionSeleccionada(p, asignacion.puesto)}>${p}</option>`).join("")}
            </select>
            <label>Fecha</label>
            <input type="date" name="fecha" value="${asignacion.fecha || ""}" required>
            <label>Hora inicio programada</label>
            <input type="time" name="horaInicioProgramada" value="${asignacion.horaInicioProgramada || ""}" required>
            <label>Hora fin programada</label>
            <input type="time" name="horaFinProgramada" value="${asignacion.horaFinProgramada || ""}" required>
            <label>Tipo de día</label>
            <select name="tipoDia">
              <option value="Turno" ${opcionSeleccionada("Turno", asignacion.tipoDia)}>Turno</option>
              <option value="Descanso" ${opcionSeleccionada("Descanso", asignacion.tipoDia)}>Descanso</option>
              <option value="Disponible" ${opcionSeleccionada("Disponible", asignacion.tipoDia)}>Disponible</option>
            </select>
            <label>Motivo</label>
            <input name="motivo" value="${asignacion.motivo || ""}" required>
            <label>¿Cambio de emergencia?</label>
            <select name="emergencia">
              <option value="no" ${!asignacion.esEmergencia ? "selected" : ""}>No</option>
              <option value="si" ${asignacion.esEmergencia ? "selected" : ""}>Sí</option>
            </select>
            <button type="submit">Guardar cambios</button>
          </form>
          <a href="/app">Volver</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (req.url.startsWith("/programar-rango")) {
    if (!requiereSupervisor(sesion, res)) return;

    enviarHTML(res, `
      <html>
      <head><title>Programar varios días</title>${estilos}</head>
      <body>
        <header><div class="logo">CF</div><h1>📆 Programar varios días</h1></header>
        <div class="contenedor">
          <form method="POST">
            <input type="hidden" name="accion" value="generar_rango">
            <label>Gestor</label>
            <select name="usuario" required>
              ${Object.entries(usuarios).filter(([u, d]) => d.rol === "gestor").map(([u, d]) => `
                <option value="${u}">${d.nombre}</option>
              `).join("")}
            </select>
            <label>Puesto</label>
            <select name="puesto" required>
              ${puestos.map(p => `<option>${p}</option>`).join("")}
            </select>
            <label>Fecha inicio</label>
            <input type="date" name="fechaInicio" required>
            <label>Fecha fin</label>
            <input type="date" name="fechaFin" required>
            <label>Motivo general</label>
            <input name="motivo" placeholder="Ej: programación quincenal">
            <button type="submit">Generar días</button>
          </form>
          <a href="/app">⬅ Volver</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (req.url.startsWith("/editar")) {
   if (!requiereSupervisor(sesion, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get("id");
    const minuta = await db.collection("minutas").findOne({ _id: new ObjectId(id) });

    if (!minuta) {
      enviarHTML(res, `<h1>Minuta no encontrada</h1><a href="/app">Volver</a>`);
      return;
    }

    enviarHTML(res, `
      <html>
      <head><title>Editar minuta</title>${estilos}</head>
      <body>
        <header><div class="logo">CF</div><h1>Editar Minuta</h1></header>
        <div class="contenedor">
          <form method="POST">
            <input type="hidden" name="accion" value="actualizar">
            <input type="hidden" name="id" value="${id}">
            <label>Puesto</label>
            <select name="puesto" required>
              ${puestos.map(p => `<option value="${p}" ${opcionSeleccionada(p, minuta.puesto)}>${p}</option>`).join("")}
            </select>
            <label>Tipo</label>
            <select name="tipo" required>
              ${tipos.map(t => `<option value="${t}" ${opcionSeleccionada(t, minuta.tipo)}>${t}</option>`).join("")}
            </select>
            <label>Novedad</label>
            <textarea name="novedad" required>${minuta.novedad || ""}</textarea>
            <button type="submit">Guardar cambios</button>
          </form>
          <a href="/app">Volver</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // ─── RUTA PRINCIPAL /app ──────────────────────────────────────────────────
  if (req.url.startsWith("/app")) {
    if (!requiereSesion(sesion, res)) return;

    const url = new URL(req.url, `http://${req.headers.host}`);

    const filtroPuesto = url.searchParams.get("puesto") || "";
    const filtroGestor = url.searchParams.get("gestor") || "";
    const filtroTipo = url.searchParams.get("tipo") || "";
    const filtroFecha = url.searchParams.get("fecha") || "";

    let minutas = await obtenerMinutasFiltradas(url, sesion);

    const turnosActivos = await db.collection("turnos").find({ estado: "Activo" }).toArray();
    const turnosCerrados = await db.collection("turnos").find({ estado: "Cerrado" }).sort({ cerradoEn: -1 }).limit(20).toArray();
    const miTurnoActivo = await db.collection("turnos").findOne({ usuario: sesion.usuario, estado: "Activo" });

    const { fechaFiltro: hoyAsignacion } = fechaColombia();
    const asignacionHoy = await db.collection("asignaciones").findOne({ usuario: sesion.usuario, fecha: hoyAsignacion });
    const asignacionesHoy = await db.collection("asignaciones").find({ fecha: hoyAsignacion }).toArray();

    const diasProgramacion = proximosDiasColombia(15);
    const fechasProgramacion = diasProgramacion.map(d => d.fecha);

    const asignaciones15Dias = await db.collection("asignaciones")
      .find({ fecha: { $in: fechasProgramacion } })
      .sort({ fecha: 1, gestor: 1 })
      .toArray();

    const miProgramacion15Dias = await db.collection("asignaciones")
      .find({ usuario: sesion.usuario, fecha: { $in: fechasProgramacion } })
      .sort({ fecha: 1 })
      .toArray();

    const opcionesPuestos = puestos.map(p => `<option>${p}</option>`).join("");
    const { fechaFiltro: hoy, mesFiltro: mesActual } = fechaColombia();

    const minutasHoy = minutas.filter(m => m.fechaFiltro === hoy).length;
    const minutasMes = minutas.filter(m => m.fechaFiltro && m.fechaFiltro.startsWith(mesActual)).length;
    const pendientes = minutas.filter(m => (m.estado || "Pendiente") === "Pendiente").length;
    const puestosActivos = new Set(turnosActivos.map(t => t.puesto)).size;

    const porPuesto = {};
    minutas.forEach(m => { porPuesto[m.puesto] = (porPuesto[m.puesto] || 0) + 1; });

    const porGestor = {};
    minutas.forEach(m => { porGestor[m.gestor] = (porGestor[m.gestor] || 0) + 1; });

    const horasPorGestor = {};
    turnosCerrados.forEach(t => {
      horasPorGestor[t.gestor] = (horasPorGestor[t.gestor] || 0) + (t.horasTrabajadas || 0);
    });

    const minutasOrdenadas = [...minutas].sort((a, b) => {
      const fechaA = `${a.fechaFiltro || ""} ${a.hora || ""}`;
      const fechaB = `${b.fechaFiltro || ""} ${b.hora || ""}`;
      return fechaB.localeCompare(fechaA);
    });

    const minutasPorPuestoApp = {};
    minutasOrdenadas.forEach(m => {
      const puesto = m.puesto || "Sin puesto";
      if (!minutasPorPuestoApp[puesto]) minutasPorPuestoApp[puesto] = [];
      minutasPorPuestoApp[puesto].push(m);
    });

    const iconoTipoMinuta = (tipo = "") => {
      const t = String(tipo).toLowerCase();
      if (t.includes("inicio")) return "🟢";
      if (t.includes("ronda")) return "🔵";
      if (t.includes("emergencia")) return "🚨";
      if (t.includes("daño")) return "⚠️";
      if (t.includes("entrega")) return "🔴";
      return "📝";
    };

    const colorLineaMinuta = (tipo = "", novedad = "") => {
      const texto = `${tipo} ${novedad}`.toLowerCase();
      if (texto.includes("emergencia") || texto.includes("robo") || texto.includes("accidente") || texto.includes("urgente")) return "#dc2626";
      if (texto.includes("daño") || texto.includes("problema") || texto.includes("falla")) return "#f59e0b";
      if (texto.includes("inicio")) return "#16a34a";
      if (texto.includes("entrega")) return "#ef4444";
      if (texto.includes("ronda")) return "#2563eb";
      return "#005baa";
    };

    const historial = Object.entries(minutasPorPuestoApp).map(([puesto, lista]) => `
      <div class="card">
        <h3 style="cursor:pointer;" onclick="toggleGrupoMinutas('${puesto.replace(/'/g, "\\'")}')">
          📍 ${puesto} (${lista.length}) ⬇
        </h3>
        <div id="grupo-minutas-${puesto.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ-]/g, "")}" style="display:none;">
          <div class="botones no-print" style="margin-bottom:15px;">
            <a class="btn btn-warning" href="/exportar-excel?puesto=${puesto}">📊 Excel ${puesto}</a>
            <a class="btn btn-warning" href="/exportar-pdf?puesto=${puesto}">📄 PDF ${puesto}</a>
          </div>
          <div style="border-left:4px solid #cbd5e1; margin-left:15px; padding-left:18px;">
            ${lista.map(m => {
              const alerta = detectarAlerta(m.novedad);
              const estadoTexto = m.estado || "Pendiente";
              const claseEstado = estadoTexto === "Revisada" ? "estado-revisada" : "";
              const colorLinea = colorLineaMinuta(m.tipo, m.novedad);
              const icono = iconoTipoMinuta(m.tipo);

              return `
                <div class="turno-card ${alerta.clase}" style="position:relative; margin-bottom:16px; border-left:5px solid ${colorLinea};">
                  <div style="
                    position:absolute; left:-39px; top:14px;
                    width:30px; height:30px; border-radius:50%;
                    background:${colorLinea}; color:white;
                    display:flex; align-items:center; justify-content:center;
                    font-size:15px; box-shadow:0 2px 8px rgba(0,0,0,0.25);
                  ">${icono}</div>
                  <div class="fecha">🕒 ${m.fecha || ""} - ${m.hora || ""}</div>
                  ${alerta.etiqueta ? `<div class="etiqueta">${alerta.etiqueta}</div>` : ""}
                  <p><b>Gestor:</b> ${m.gestor || ""}</p>
                  <p><b>Tipo:</b> ${m.tipo || ""}</p>
                  <p><b>Estado:</b> <span class="${claseEstado}">${estadoTexto}</span></p>
                  ${m.revisadaPor ? `<p><b>Revisada por:</b> ${m.revisadaPor}</p>` : ""}
                  <p><b>Novedad:</b> ${m.novedad || ""}</p>
                  ${m.foto ? `<img class="foto" src="${m.foto}" alt="Foto evidencia">` : ""}

                  ${sesion.rol === "supervisor" ? htmlUbicacion(m.ubicacion, "Ubicación del registro") : ""}

                  ${sesion.rol === "supervisor" ? `
                    <div class="botones no-print" style="margin-top:10px;">
                      <a class="btn btn-warning" href="/editar?id=${m._id}">✏️ Editar</a>
                      ${(m.estado || "Pendiente") === "Pendiente" ? `
                        <form method="POST" style="box-shadow:none;padding:0;margin:0;">
                          <input type="hidden" name="accion" value="revisada">
                          <input type="hidden" name="id" value="${m._id}">
                          <button class="btn-success" type="submit">✅ Marcar revisada</button>
                        </form>
                      ` : ""}
                      <form method="POST" onsubmit="return confirm('¿Seguro que deseas eliminar esta minuta?');" style="box-shadow:none;padding:0;margin:0;">
                        <input type="hidden" name="accion" value="eliminar">
                        <input type="hidden" name="id" value="${m._id}">
                        <button class="btn-danger" type="submit">🗑️ Eliminar</button>
                      </form>
                    </div>
                  ` : ""}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `).join("");

    const gestoresSistema = Object.values(usuarios).filter(u => u.rol === "gestor").map(u => u.nombre);

    const filtrosSupervisor = `
      <form class="filtros no-print" method="GET" action="/app">
        <h2>Filtros de supervisor</h2>
        <div class="grid-filtros">
          <div>
            <label>Puesto</label>
            <select name="puesto">
              <option value="">Todos</option>
              ${puestos.map(p => `<option value="${p}" ${opcionSeleccionada(p, filtroPuesto)}>${p}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Gestor</label>
            <select name="gestor">
              <option value="">Todos</option>
              ${gestoresSistema.map(g => `<option value="${g}" ${opcionSeleccionada(g, filtroGestor)}>${g}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Tipo</label>
            <select name="tipo">
              <option value="">Todos</option>
              ${tipos.map(t => `<option value="${t}" ${opcionSeleccionada(t, filtroTipo)}>${t}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Fecha</label>
            <input type="date" name="fecha" value="${filtroFecha}">
          </div>
        </div>
        <button type="submit">Aplicar filtros</button>
        <div class="botones" style="margin-top:10px;">
          <a class="btn btn-warning" href="/exportar-excel?puesto=${filtroPuesto}&gestor=${filtroGestor}&tipo=${filtroTipo}&fecha=${filtroFecha}">📊 Descargar Excel</a>
          <a class="btn btn-warning" href="/exportar-pdf?puesto=${filtroPuesto}&gestor=${filtroGestor}&tipo=${filtroTipo}&fecha=${filtroFecha}">📄 Descargar PDF</a>
          <a class="btn btn-warning" href="/app">Quitar filtros</a>
        </div>
      </form>
    `;

    const programacionSimpleHTML = Object.entries(usuarios)
      .filter(([usuario, datos]) => datos.rol === "gestor")
      .map(([usuario, datos]) => {
        const lista = asignaciones15Dias.filter(a => a.usuario === usuario);
        return `
          <details class="card">
            <summary style="cursor:pointer; font-size:18px; font-weight:bold; color:#005baa;">
              👤 ${datos.nombre} (${lista.length} días programados) ⬇
            </summary>
            <div style="margin-top:15px;">
              <div class="botones no-print" style="margin-bottom:10px;">
                <a class="btn btn-warning" href="/exportar-programacion-excel?usuario=${encodeURIComponent(usuario)}">📊 Excel de ${datos.nombre}</a>
                <a class="btn btn-warning" href="/exportar-programacion-pdf?usuario=${encodeURIComponent(usuario)}">📄 PDF de ${datos.nombre}</a>
              </div>
              ${lista.length === 0
                ? `<p>No tiene programación en los próximos 15 días.</p>`
                : `
                  <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px;">
                      <tr style="background:#eaf3ff;">
                        <th style="padding:10px;">Fecha</th>
                        <th style="padding:10px;">Puesto</th>
                        <th style="padding:10px;">Horario</th>
                        <th style="padding:10px;">Tipo</th>
                        <th style="padding:10px;">Motivo</th>
                        <th style="padding:10px;">Historial</th>
                        <th style="padding:10px;">Acciones</th>
                      </tr>
                      ${lista.map(a => `
                        <tr style="border-bottom:1px solid #ddd;">
                          <td style="padding:10px;">${a.fecha || ""}</td>
                          <td style="padding:10px;">${a.puesto || ""}</td>
                          <td style="padding:10px;">${a.tipoDia === "Descanso" ? "Descanso" : `${a.horaInicioProgramada || ""} - ${a.horaFinProgramada || ""}`}</td>
                          <td style="padding:10px;">${a.tipoDia || "Turno"}</td>
                          <td style="padding:10px;">${a.motivo || ""}</td>
                          <td style="padding:10px;">
                            <button class="btn" onclick="toggleHistorial('${a._id}')">📜 Ver</button>
                            <div id="historial-${a._id}" style="display:none; margin-top:10px; font-size:12px;">
                              ${(a.historialCambios || []).length === 0
                                ? "<p>No hay historial</p>"
                                : a.historialCambios.map(h => `
                                  <div style="border:1px solid #ddd; padding:6px; margin-bottom:6px; border-radius:6px;">
                                    <b>${h.accion}</b><br>
                                    👤 ${h.nombreAccion}<br>
                                    🕒 ${new Date(h.fechaAccion).toLocaleString()}<br>
                                  </div>
                                `).join("")}
                            </div>
                          </td>
                          <td style="padding:10px;">
                            <a class="btn btn-warning" href="/editar-asignacion?id=${a._id}">✏️</a>
                            <form method="POST" style="display:inline; box-shadow:none; padding:0; margin:0;">
                              <input type="hidden" name="accion" value="eliminar_asignacion">
                              <input type="hidden" name="id" value="${a._id}">
                              <button class="btn-danger" type="submit">🗑️</button>
                            </form>
                          </td>
                        </tr>
                      `).join("")}
                    </table>
                  </div>
                `}
            </div>
          </details>
        `;
      }).join("");

    const formularioAsignacion = `
      <div class="panel">
        <h2>📅 Programación avanzada de puestos</h2>
        <p>Desde aquí puedes asignar turnos, descansos o disponibilidad para los próximos 15 días.</p>
        <div class="botones no-print" style="margin-bottom:15px;">
          <a class="btn btn-success" href="/programar-rango">📆 Programar varios días</a>
          <a class="btn btn-warning" href="/exportar-programacion-excel">📊 Descargar programación Excel</a>
          <a class="btn btn-warning" href="/exportar-programacion-pdf">📄 Descargar programación PDF</a>
        </div>
        <form method="POST">
          <input type="hidden" name="accion" value="asignar">
          <label>Gestor</label>
          <select name="usuario" required>
            ${Object.entries(usuarios).filter(([u, d]) => d.rol === "gestor").map(([u, d]) => `<option value="${u}">${d.nombre}</option>`).join("")}
          </select>
          <label>Puesto</label>
          <select name="puesto" required>${puestos.map(p => `<option>${p}</option>`).join("")}</select>
          <label>Fecha</label>
          <input type="date" name="fecha" value="${hoyAsignacion}" required>
          <label>Hora inicio programada</label>
          <input type="time" name="horaInicioProgramada" required>
          <label>Hora fin programada</label>
          <input type="time" name="horaFinProgramada" required>
          <label>Tipo de día</label>
          <select name="tipoDia">
            <option value="Turno">Turno</option>
            <option value="Descanso">Descanso</option>
            <option value="Disponible">Disponible</option>
          </select>
          <label>Motivo</label>
          <input name="motivo" placeholder="Ej: turno normal, descanso, cambio por emergencia..." required>
          <label>¿Cambio de emergencia?</label>
          <select name="emergencia">
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
          <button type="submit">💾 Guardar asignación</button>
        </form>
        <h3>🗓️ Programación próximos 15 días por gestor</h3>
        ${programacionSimpleHTML}
      </div>
    `;

    const dashboardSupervisor = `
      <div class="panel">
        <h2>📊 Dashboard Gerencial</h2>
        <div class="dashboard">
          <div class="metric"><p>Novedades hoy</p><strong>${minutasHoy}</strong></div>
          <div class="metric"><p>Novedades del mes</p><strong>${minutasMes}</strong></div>
          <div class="metric"><p>Pendientes</p><strong>${pendientes}</strong></div>
          <div class="metric"><p>Puestos activos</p><strong>${puestosActivos}</strong></div>
        </div>
        <h3>Por puesto</h3>
        ${Object.entries(porPuesto).map(([p, c]) => `<p>${p}: <b>${c}</b></p>`).join("") || "<p>Sin datos</p>"}
        <h3>Por gestor</h3>
        ${Object.entries(porGestor).map(([g, c]) => `<p>${g}: <b>${c}</b></p>`).join("") || "<p>Sin datos</p>"}
        <h3>Total de horas trabajadas por gestor</h3>
        ${Object.entries(horasPorGestor).map(([g, h]) => `<p>${g}: <b>${Number(h).toFixed(2)} horas</b></p>`).join("") || "<p>Sin turnos cerrados todavía.</p>"}
      </div>
    `;

    // Gestores en turno (supervisor ve la ubicación de entrada)
    const gestoresTurnoHTML = `
      <div class="panel">
        <h2>👷 Gestores en turno</h2>
        ${turnosActivos.length === 0
          ? "<p>No hay gestores en turno.</p>"
          : turnosActivos.map(t => `
            <div class="turno-card">
              <p><b>${t.gestor}</b></p>
              <p><b>Puesto:</b> ${t.puesto}</p>
              <p><b>Fecha:</b> ${t.fecha || ""}</p>
              <p><b>Entrada:</b> ${t.horaEntrada || ""}</p>
              <p><b>Tipo de turno:</b> ${t.tipoTurno || "No registrado"}</p>
              <p><b>Estado:</b> <span class="estado-activo">${t.estado}</span></p>
              ${sesion.rol === "supervisor" ? htmlUbicacion(t.ubicacionEntrada, "📍 Ubicación al iniciar turno") : ""}
            </div>
          `).join("")}
      </div>
    `;

    const turnosPorGestor = {};
    turnosCerrados.forEach(t => {
      const gestor = t.gestor || "Sin gestor";
      if (!turnosPorGestor[gestor]) turnosPorGestor[gestor] = [];
      turnosPorGestor[gestor].push(t);
    });

    const historialTurnosHTML = `
      <div class="panel">
        <h2>🕒 Historial de turnos cerrados por gestor</h2>
        <div class="botones no-print" style="margin-bottom:15px;">
          <a class="btn btn-warning" href="/exportar-turnos-excel">📊 Descargar turnos Excel</a>
          <a class="btn btn-warning" href="/exportar-turnos-pdf">📄 Descargar turnos PDF</a>
        </div>
        ${Object.keys(turnosPorGestor).length === 0
          ? "<p>No hay turnos cerrados todavía.</p>"
          : Object.entries(turnosPorGestor).map(([gestor, lista]) => {
              const totalHoras = lista.reduce((acc, t) => acc + (Number(t.horasTrabajadas) || 0), 0);
              const idGestor = gestor.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ-]/g, "");

              return `
                <div class="card">
                  <h3 style="cursor:pointer;" onclick="toggleTurnos('${idGestor}')">
                    👤 ${gestor} (${lista.length} turnos) ⬇
                  </h3>
                  <div id="grupo-turnos-${idGestor}" style="display:none;">
                    <div class="botones no-print" style="margin-bottom:10px;">
                      <a class="btn btn-warning" href="/exportar-turnos-excel?gestor=${gestor}">📊 Excel de ${gestor}</a>
                      <a class="btn btn-warning" href="/exportar-turnos-pdf?gestor=${gestor}">📄 PDF de ${gestor}</a>
                    </div>
                    ${lista.map(t => `
                      <div class="turno-card">
                        <p><b>Puesto:</b> ${t.puesto || ""}</p>
                        <p><b>Entrada:</b> ${t.fecha || ""} - ${t.horaEntrada || ""}</p>
                        <p><b>Salida:</b> ${t.fechaSalida || ""} - ${t.horaSalida || ""}</p>
                        <p><b>Tiempo trabajado:</b> ${t.tiempoTrabajado || `${t.horasTrabajadas || 0} horas`}</p>
                        <p><b>Horario programado:</b> ${t.horarioProgramado || "Sin horario"}</p>
                        <p><b>Cumplimiento:</b> ${t.estadoCumplimiento || "No analizado"}</p>
                        <p><b>Detalle:</b> ${t.resumenCumplimiento || ""}</p>
                        ${sesion.rol === "supervisor" ? htmlUbicacion(t.ubicacionEntrada, "📍 Ubicación entrada") : ""}
                        ${sesion.rol === "supervisor" ? htmlUbicacion(t.ubicacionSalida, "📍 Ubicación salida") : ""}
                        <form method="POST" onsubmit="return confirm('¿Seguro que deseas eliminar este turno cerrado?');" style="box-shadow:none;padding:0;margin:8px 0 0 0;">
                          <input type="hidden" name="accion" value="eliminar_turno">
                          <input type="hidden" name="id" value="${t._id}">
                          <button class="btn-danger" type="submit">🗑️ Eliminar turno</button>
                        </form>
                      </div>
                    `).join("")}
                    <div class="contador">Total de horas trabajadas: ${totalHoras.toFixed(2)} horas</div>
                  </div>
                </div>
              `;
            }).join("")}
      </div>
    `;

    const programacionGestorHTML = `
      <div class="panel">
        <h2>📆 Mi programación próximos 15 días</h2>
        ${miProgramacion15Dias.length === 0
          ? "<p>No tienes programación registrada para los próximos días.</p>"
          : `
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse;">
                <tr style="background:#eaf3ff;">
                  <th style="padding:10px; text-align:left;">Fecha</th>
                  <th style="padding:10px; text-align:left;">Puesto</th>
                  <th style="padding:10px; text-align:left;">Horario</th>
                  <th style="padding:10px; text-align:left;">Tipo</th>
                </tr>
                ${miProgramacion15Dias.map(a => `
                  <tr style="border-bottom:1px solid #ddd;">
                    <td style="padding:10px;">${a.fecha || ""}</td>
                    <td style="padding:10px;">${a.puesto || ""}</td>
                    <td style="padding:10px;">${a.tipoDia === "Descanso" ? "Descanso" : `${a.horaInicioProgramada || ""} - ${a.horaFinProgramada || ""}`}</td>
                    <td style="padding:10px;">${a.tipoDia || "Turno"}</td>
                  </tr>
                `).join("")}
              </table>
            </div>
          `}
      </div>
    `;

    // ── Formulario del gestor con botones de ubicación ───────────────────────
    const formularioGestor = `
      ${miTurnoActivo
        ? `
          <div class="panel">
            <h2>🟢 Turno activo</h2>
            <p><b>Gestor:</b> ${miTurnoActivo.gestor}</p>
            <p><b>Puesto:</b> ${miTurnoActivo.puesto}</p>
            <p><b>Fecha:</b> ${miTurnoActivo.fecha || ""}</p>
            <p><b>Hora entrada:</b> ${miTurnoActivo.horaEntrada || ""}</p>
            <p><b>Tipo de turno:</b> ${miTurnoActivo.tipoTurno || "No registrado"}</p>
            <p><b>Estado:</b> <span class="estado-activo">${miTurnoActivo.estado}</span></p>

            <form id="form-cerrar-turno" method="POST" action="/cerrar-turno" style="box-shadow:none;padding:0;margin-top:10px;">
              <input type="hidden" name="lat" value="">
              <input type="hidden" name="lng" value="">
              <input type="hidden" name="precision" value="">
              <button
                type="button"
                id="btn-cerrar-turno"
                class="btn-ubicacion btn-danger"
                data-texto-original="🔴 Cerrar turno"
                onclick="enviarConUbicacion('form-cerrar-turno', 'btn-cerrar-turno')"
                style="margin-top:10px;"
              >
                🔴 Cerrar turno
              </button>
            </form>
          </div>
        `
        : `
          <form id="form-iniciar-turno" method="POST" action="/iniciar-turno">
            <input type="hidden" name="lat" value="">
            <input type="hidden" name="lng" value="">
            <input type="hidden" name="precision" value="">

            <label>Iniciar turno</label>
            <select name="puesto" required>
              ${opcionesPuestos}
            </select>

            <button
              type="button"
              id="btn-iniciar-turno"
              class="btn-ubicacion"
              data-texto-original="🟢 Iniciar turno"
              onclick="enviarConUbicacion('form-iniciar-turno', 'btn-iniciar-turno')"
            >
              🟢 Iniciar turno
            </button>
          </form>
        `}

      <form id="form-minuta" method="POST" action="/guardar" enctype="multipart/form-data">
        <input type="hidden" name="lat" value="">
        <input type="hidden" name="lng" value="">
        <input type="hidden" name="precision" value="">

        <label>Gestor</label>
        <input value="${sesion.nombre}" readonly>

        <label>Puesto del turno</label>
        <select name="puesto" required>
          ${opcionesPuestos}
        </select>

        <label>Tipo de registro</label>
        <select name="tipo" required>
          ${tipos.map(t => `<option>${t}</option>`).join("")}
        </select>

        <label>Novedad</label>
        <textarea name="novedad" required placeholder="Escribe aquí lo ocurrido..."></textarea>

        <label>Foto evidencia</label>
        <input type="file" name="foto" accept="image/*" capture="environment">

        <button
          type="button"
          id="btn-guardar-minuta"
          class="btn-ubicacion"
          data-texto-original="📝 Guardar minuta"
          onclick="enviarConUbicacion('form-minuta', 'btn-guardar-minuta')"
        >
          📝 Guardar minuta
        </button>
      </form>
    `;
    // ─────────────────────────────────────────────────────────────────────────

    enviarHTML(res, `
      <html>
      <head>
        <title>Minuta Consotá</title>
        ${estilos}
        ${scriptUbicacion}
      </head>
      <body>
        <header>
          <div class="logo">CF</div>
          <h1>Minuta Digital Consotá</h1>
          <p>${sesion.nombre} | ${sesion.rol}</p>
        </header>

        <div class="contenedor">
          ${sesion.rol === "supervisor" ? filtrosSupervisor : ""}
          ${sesion.rol === "supervisor" ? formularioAsignacion + dashboardSupervisor + gestoresTurnoHTML + historialTurnosHTML : ""}
          ${sesion.rol === "gestor" ? programacionGestorHTML + formularioGestor : `
            <div class="panel">
              <h2>Panel Supervisor</h2>
              <p>Aquí puedes ver todas las minutas registradas por todos los gestores.</p>
            </div>
          `}

          <div class="contador">
            Total de minutas mostradas: ${minutas.length}
          </div>

          <h2>Historial de minutas</h2>
          ${historial || "<p>No hay minutas guardadas todavía.</p>"}

          <a class="cerrar no-print" href="/logout">Cerrar sesión</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  enviarHTML(res, vistaLogin(estilos));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor corriendo en puerto " + PORT);
});