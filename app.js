const http = require("http");
const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const ExcelJS = require("exceljs");

const MONGO_URL = "mongodb+srv://Jaider:1004756226@cluster0.rue5x5j.mongodb.net/?appName=Cluster0";

const client = new MongoClient(MONGO_URL);
let db;

async function conectarDB() {
  try {
    await client.connect();
    db = client.db("minutasDB");
    console.log("🔥 Conectado a MongoDB");
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
  }
}

const dbReady = conectarDB();

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

function novadadSeguro(texto = "") {
  return String(texto || "").toLowerCase();
}

function detectarAlerta(novedad = "") {
  const texto = novadadSeguro(novedad);

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

const estilos = `
<style>
  body {
    font-family: Arial, sans-serif;
    background: linear-gradient(135deg, #eaf3ff, #ffffff);
    margin: 0;
    color: #1f2937;
  }

  .login-body {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: linear-gradient(135deg, #005baa, #ffffff);
  }

  .login-card {
    background: white;
    width: 370px;
    padding: 30px;
    border-radius: 22px;
    box-shadow: 0 15px 35px rgba(0,0,0,0.18);
    text-align: center;
  }

  .logo {
    width: 95px;
    height: 95px;
    border-radius: 50%;
    margin: 0 auto 12px;
    background: radial-gradient(circle, #f5c542 0%, #d9a51e 45%, #005baa 46%, #005baa 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-weight: bold;
    font-size: 28px;
    border: 5px solid white;
    box-shadow: 0 4px 14px rgba(0,0,0,0.2);
  }

  .marca { color: #005baa; margin-bottom: 3px; }
  .submarca { color: #555; font-size: 14px; margin-bottom: 25px; }

  header {
    background: #005baa;
    color: white;
    padding: 22px;
    text-align: center;
    border-bottom: 6px solid #f5c542;
  }

  header h1 { margin: 0; }

  .contenedor {
    max-width: 1050px;
    margin: 30px auto;
    padding: 20px;
  }

  form, .card, .panel {
    background: white;
    padding: 22px;
    border-radius: 16px;
    margin-bottom: 18px;
    box-shadow: 0 5px 16px rgba(0,0,0,0.08);
  }

  label {
    color: #005baa;
    font-weight: bold;
  }

  input, select, textarea {
    width: 100%;
    padding: 12px;
    margin: 8px 0 16px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 15px;
    box-sizing: border-box;
  }

  textarea { height: 105px; }

  button, .btn {
    background: #005baa;
    color: white;
    padding: 12px 14px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    cursor: pointer;
    font-weight: bold;
    text-decoration: none;
    display: inline-block;
    text-align: center;
  }

  button:hover, .btn:hover { background: #003f7d; }

  .btn-danger { background: #dc2626; }
  .btn-danger:hover { background: #991b1b; }

  .btn-warning {
    background: #f5c542;
    color: #1f2937;
  }

  .btn-warning:hover { background: #d9a51e; }

  .btn-success {
    background: #16a34a;
  }

  .btn-success:hover {
    background: #15803d;
  }

  .card { border-left: 6px solid #005baa; }

  .fecha {
    color: #64748b;
    font-size: 13px;
  }

  h2, h3 { color: #005baa; }

  a {
    color: #005baa;
    font-weight: bold;
  }

  .cerrar {
    display: inline-block;
    margin-top: 15px;
  }

  .foto {
    width: 100%;
    max-width: 340px;
    border-radius: 12px;
    margin-top: 10px;
    border: 1px solid #ddd;
  }

  .filtros {
    border-top: 6px solid #f5c542;
  }

  .grid-filtros {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
  }

  .botones {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .botones a, .botones button, .botones form {
    flex: 1;
  }

  .contador {
    background: #005baa;
    color: white;
    padding: 12px;
    border-radius: 12px;
    margin-bottom: 15px;
    font-weight: bold;
  }

  .dashboard {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-bottom: 18px;
  }

  .metric {
    background: #eaf3ff;
    border-left: 6px solid #005baa;
    padding: 15px;
    border-radius: 12px;
  }

  .metric strong {
    font-size: 24px;
    color: #005baa;
  }

  .turno-card {
    background: #f8fafc;
    border-left: 5px solid #22c55e;
    padding: 12px;
    border-radius: 12px;
    margin-bottom: 10px;
  }

  .estado-activo {
    color: #16a34a;
    font-weight: bold;
  }

  .estado-revisada {
    color: #2563eb;
    font-weight: bold;
  }

  .alerta-roja {
    border-left: 6px solid #dc2626 !important;
    background: #fee2e2;
  }

  .alerta-amarilla {
    border-left: 6px solid #f59e0b !important;
    background: #fef3c7;
  }

  .etiqueta {
    font-weight: bold;
    margin-bottom: 8px;
  }

  @media (max-width: 700px) {
    .grid-filtros, .dashboard {
      grid-template-columns: 1fr;
    }

    .login-card {
      width: 85%;
    }

    .botones {
      flex-direction: column;
    }
  }

  @media print {
    button, .cerrar, .no-print {
      display: none !important;
    }
  }
</style>
`;

const server = http.createServer(async (req, res) => {
  await dbReady;

  const cookies = getCookies(req);
  const sessionId = cookies.sessionId;
  const sesion = sesiones[sessionId];

  if (req.url.startsWith("/exportar-excel")) {
    if (!sesion || sesion.rol !== "supervisor") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

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
      { header: "Foto", key: "foto", width: 55 }
    ];

    minutas.forEach(m => worksheet.addRow({
      ...m,
      estado: m.estado || "Pendiente"
    }));

    res.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=minutas.xlsx"
    });

    await workbook.xlsx.write(res);
    res.end();
    return;
  }

  if (req.url.startsWith("/exportar-programacion-excel")) {
    if (!sesion || sesion.rol !== "supervisor") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

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

  if (req.url.startsWith("/exportar-pdf")) {
    if (!sesion || sesion.rol !== "supervisor") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const minutas = await obtenerMinutasFiltradas(url, sesion);

   const contenido = (() => {

  const minutasPorPuesto = {};

  minutas.forEach(m => {
    if (!minutasPorPuesto[m.puesto]) {
      minutasPorPuesto[m.puesto] = [];
    }
    minutasPorPuesto[m.puesto].push(m);
  });

  return Object.keys(minutasPorPuesto).map(puesto => `
    <div class="card">
      <h3 style="cursor:pointer;" onclick="toggle('${puesto}')">
        ${puesto} ⬇
      </h3>

      <div id="grupo-${puesto}" style="display:none;">

        ${
          minutasPorPuesto[puesto]
            .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
            .map(m => `
              <div class="turno-card">
                <p><b>${m.gestor || ""}</b></p>
                <p>${m.novedad || ""}</p>
                <p>${m.fecha || ""}</p>
              </div>
            `).join("")
        }

      </div>
    </div>
  `).join("");

})();

    enviarHTML(res, `
      <html>
      <head>
  <title>Reporte de Minutas</title>
  ${estilos}

  <script>
    function toggle(puesto) {
      const el = document.getElementById("grupo-" + puesto);
      if (el.style.display === "none") {
        el.style.display = "block";
      } else {
        el.style.display = "none";
      }
    }
  </script>

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

  if (req.method === "POST" && req.url === "/guardar") {
    if (!sesion || sesion.rol !== "gestor") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

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

          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        }

        const { fecha, hora, fechaFiltro } = fechaColombia();

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
          foto: fotoUrl
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

  if (req.method === "POST" && req.url === "/iniciar-turno") {
    if (!sesion || sesion.rol !== "gestor") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    let datos = "";

    req.on("data", parte => datos += parte);

    req.on("end", async () => {
      const form = new URLSearchParams(datos);
      const puesto = form.get("puesto");
      const { fecha, hora, fechaFiltro } = fechaColombia();

      const turnoActivo = await db.collection("turnos").findOne({
        usuario: sesion.usuario,
        estado: "Activo"
      });

      if (turnoActivo) {
        res.writeHead(302, { Location: "/app" });
        res.end();
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
  creadoEn: new Date()
};

      await db.collection("turnos").insertOne(turno);

      res.writeHead(302, { Location: "/app" });
      res.end();
    });

    return;
  }

  if (req.method === "POST" && req.url === "/cerrar-turno") {
    if (!sesion || sesion.rol !== "gestor") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

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
        : "Sin horario"
    }
  }
);

    res.writeHead(302, { Location: "/app" });
    res.end();
    return;
  }

  if (req.method === "POST") {
  let datos = "";

  req.on("data", parte => datos += parte);

  req.on("end", async () => {
    const form = new URLSearchParams(datos);
    const accion = form.get("accion");

    if (accion === "login") {
      const usuario = (form.get("usuario") || "").toLowerCase();
      const clave = form.get("clave");

      if (!usuarios[usuario] || usuarios[usuario].clave !== clave) {
        enviarHTML(res, `
          <html>
          <head>${estilos}</head>
          <body class="login-body">
            <div class="login-card">
              <div class="logo">CF</div>
              <h1 class="marca">Datos incorrectos ❌</h1>
              <p>Usuario o clave incorrecta.</p>
              <a href="/">Volver</a>
            </div>
          </body>
          </html>
        `);
        return;
      }

      const id = crypto.randomBytes(16).toString("hex");

      sesiones[id] = {
        usuario,
        nombre: usuarios[usuario].nombre,
        rol: usuarios[usuario].rol
      };

      res.writeHead(302, {
        "Set-Cookie": `sessionId=${id}; HttpOnly; Path=/`,
        Location: "/app"
      });
      res.end();
      return;
    }

    if (accion === "revisada") {
      if (!sesion || sesion.rol !== "supervisor") {
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
      }

      const id = form.get("id");

      await db.collection("minutas").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            estado: "Revisada",
            revisadaPor: sesion.nombre,
            revisadaEn: new Date()
          }
        }
      );

      res.writeHead(302, { Location: "/app" });
      res.end();
      return;
    }

    if (accion === "asignar") {
      if (!sesion || sesion.rol !== "supervisor") {
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
      }

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

      await db.collection("asignaciones").updateOne(
        { usuario, fecha },
        {
          $set: {
            gestor,
            usuario,
            puesto,
            fecha,
            horaInicioProgramada,
            horaFinProgramada,
            tipoDia,
            motivo,
            esEmergencia: emergencia,
            actualizadoPor: sesion.nombre,
            actualizadoEn: new Date()
          },
          $setOnInsert: {
            creadoPor: sesion.nombre,
            creadoEn: new Date()
          }
        },
        { upsert: true }
      );

      res.writeHead(302, { Location: "/app" });
      res.end();
      return;
    }

    if (accion === "eliminar_asignacion") {
      if (!sesion || sesion.rol !== "supervisor") {
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
      }

      const id = form.get("id");

      await db.collection("asignaciones").deleteOne({
        _id: new ObjectId(id)
      });

      res.writeHead(302, { Location: "/app" });
      res.end();
      return;
    }

if (accion === "actualizar_asignacion") {
  if (!sesion || sesion.rol !== "supervisor") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }


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


  await db.collection("asignaciones").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        usuario,
        gestor: usuarios[usuario].nombre,
        puesto,
        fecha,
        horaInicioProgramada,
        horaFinProgramada,
        tipoDia,
        motivo,
        esEmergencia: emergencia,
        actualizadoPor: sesion.nombre,
        actualizadoEn: new Date()
      }
    }
  );

  res.writeHead(302, { Location: "/app" });
  res.end();
  return;
}

if (accion === "generar_rango") {
  if (!sesion || sesion.rol !== "supervisor") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }

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
    const fecha = inicio.toISOString().slice(0, 10);
    dias.push(fecha);
    inicio.setDate(inicio.getDate() + 1);
  }

  const gestor = usuarios[usuario].nombre;

  enviarHTML(res, `
    <html>
    <head>
      <title>Editar programación</title>
      ${estilos}
    </head>
    <body>
      <header>
        <div class="logo">CF</div>
        <h1>🛠️ Configurar días</h1>
      </header>

      <div class="contenedor">
        <form method="POST">
          <input type="hidden" name="accion" value="guardar_rango">
          <input type="hidden" name="usuario" value="${usuario}">
          <input type="hidden" name="puesto" value="${puesto}">
          <input type="hidden" name="motivo" value="${motivo}">

          ${
            dias.map((fecha, i) => `
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
            `).join("")
          }

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
  if (!sesion || sesion.rol !== "supervisor") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }

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
        $set: {
          usuario,
          gestor,
          puesto,
          fecha,
          horaInicioProgramada: inicio,
          horaFinProgramada: fin,
          tipoDia,
          motivo,
          esEmergencia: false,
          actualizadoPor: sesion.nombre,
          actualizadoEn: new Date()
        }
      },
      { upsert: true }
    );
  }

  res.writeHead(302, { Location: "/app" });
  res.end();
  return;
}


    if (accion === "eliminar") {
      if (!sesion || sesion.rol !== "supervisor") {
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
      }

      const id = form.get("id");

      await db.collection("minutas").deleteOne({
        _id: new ObjectId(id)
      });

      res.writeHead(302, { Location: "/app" });
      res.end();
      return;
    }

    if (accion === "actualizar") {
      if (!sesion || sesion.rol !== "supervisor") {
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
      }

      const id = form.get("id");

      await db.collection("minutas").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            puesto: form.get("puesto"),
            tipo: form.get("tipo"),
            novedad: form.get("novedad")
          }
        }
      );

      res.writeHead(302, { Location: "/app" });
      res.end();
      return;
    }

    res.writeHead(302, { Location: "/app" });
    res.end();
  });

  return;
}


  if (req.url === "/logout") {
    if (sessionId) delete sesiones[sessionId];

    res.writeHead(302, {
      "Set-Cookie": "sessionId=; Max-Age=0; Path=/",
      Location: "/"
    });
    res.end();
    return;
  }

if (req.url.startsWith("/editar-asignacion")) {
  if (!sesion || sesion.rol !== "supervisor") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get("id");

  const asignacion = await db.collection("asignaciones").findOne({
    _id: new ObjectId(id)
  });

  if (!asignacion) {
    enviarHTML(res, `<h1>Asignación no encontrada</h1><a href="/app">Volver</a>`);
    return;
  }

  enviarHTML(res, `
    <html>
    <head>
      <title>Editar asignación</title>
      ${estilos}
    </head>
    <body>
      <header>
        <div class="logo">CF</div>
        <h1>Editar asignación</h1>
      </header>

      <div class="contenedor">
        <form method="POST">
          <input type="hidden" name="accion" value="actualizar_asignacion">
          <input type="hidden" name="id" value="${id}">

          <label>Gestor</label>
          <select name="usuario" required>
            ${Object.entries(usuarios)
              .filter(([usuario, datos]) => datos.rol === "gestor")
              .map(([usuario, datos]) => `
                <option value="${usuario}" ${opcionSeleccionada(usuario, asignacion.usuario)}>
                  ${datos.nombre}
                </option>
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
  if (!sesion || sesion.rol !== "supervisor") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }

  enviarHTML(res, `
    <html>
    <head>
      <title>Programar varios días</title>
      ${estilos}
    </head>
    <body>
      <header>
        <div class="logo">CF</div>
        <h1>📆 Programar varios días</h1>
      </header>

      <div class="contenedor">
        <form method="POST">
          <input type="hidden" name="accion" value="generar_rango">

          <label>Gestor</label>
          <select name="usuario" required>
            ${Object.entries(usuarios)
              .filter(([u, d]) => d.rol === "gestor")
              .map(([u, d]) => `<option value="${u}">${d.nombre}</option>`)
              .join("")}
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
    if (!sesion || sesion.rol !== "supervisor") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get("id");

    const minuta = await db.collection("minutas").findOne({
      _id: new ObjectId(id)
    });

    if (!minuta) {
      enviarHTML(res, `<h1>Minuta no encontrada</h1><a href="/app">Volver</a>`);
      return;
    }

    const opcionesPuestos = puestos.map(p => `
      <option value="${p}" ${opcionSeleccionada(p, minuta.puesto)}>${p}</option>
    `).join("");

    const opcionesTipos = tipos.map(t => `
      <option value="${t}" ${opcionSeleccionada(t, minuta.tipo)}>${t}</option>
    `).join("");

    enviarHTML(res, `
      <html>
      <head>
        <title>Editar minuta</title>
        ${estilos}
      </head>
      <body>
        <header>
          <div class="logo">CF</div>
          <h1>Editar Minuta</h1>
        </header>

        <div class="contenedor">
          <form method="POST">
            <input type="hidden" name="accion" value="actualizar">
            <input type="hidden" name="id" value="${id}">

            <label>Puesto</label>
            <select name="puesto" required>${opcionesPuestos}</select>

            <label>Tipo</label>
            <select name="tipo" required>${opcionesTipos}</select>

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

  if (req.url.startsWith("/app")) {
    if (!sesion) {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    const filtroPuesto = url.searchParams.get("puesto") || "";
    const filtroGestor = url.searchParams.get("gestor") || "";
    const filtroTipo = url.searchParams.get("tipo") || "";
    const filtroFecha = url.searchParams.get("fecha") || "";

    let minutas = await obtenerMinutasFiltradas(url, sesion);

    const turnosActivos = await db.collection("turnos")
      .find({ estado: "Activo" })
      .toArray();

    const turnosCerrados = await db.collection("turnos")
      .find({ estado: "Cerrado" })
      .sort({ cerradoEn: -1 })
      .limit(20)
      .toArray();

    const miTurnoActivo = await db.collection("turnos").findOne({
      usuario: sesion.usuario,
      estado: "Activo"
    });

    const { fechaFiltro: hoyAsignacion } = fechaColombia();

    const asignacionHoy = await db.collection("asignaciones").findOne({
      usuario: sesion.usuario,
      fecha: hoyAsignacion
    });

    const asignacionesHoy = await db.collection("asignaciones")
      .find({ fecha: hoyAsignacion })
      .toArray();

const diasProgramacion = proximosDiasColombia(15);
const fechasProgramacion = diasProgramacion.map(d => d.fecha);

const asignaciones15Dias = await db.collection("asignaciones")
  .find({ fecha: { $in: fechasProgramacion } })
  .sort({ fecha: 1, gestor: 1 })
  .toArray();

const miProgramacion15Dias = await db.collection("asignaciones")
  .find({
    usuario: sesion.usuario,
    fecha: { $in: fechasProgramacion }
  })
  .sort({ fecha: 1 })
  .toArray();

    const opcionesPuestos = puestos.map(p => `<option>${p}</option>`).join("");

    const { fechaFiltro: hoy, mesFiltro: mesActual } = fechaColombia();

    const minutasHoy = minutas.filter(m => m.fechaFiltro === hoy).length;

    const minutasMes = minutas.filter(m =>
      m.fechaFiltro && m.fechaFiltro.startsWith(mesActual)
    ).length;

    const pendientes = minutas.filter(m => (m.estado || "Pendiente") === "Pendiente").length;
    const puestosActivos = new Set(turnosActivos.map(t => t.puesto)).size;

    const porPuesto = {};
    minutas.forEach(m => {
      porPuesto[m.puesto] = (porPuesto[m.puesto] || 0) + 1;
    });

    const porGestor = {};
    minutas.forEach(m => {
      porGestor[m.gestor] = (porGestor[m.gestor] || 0) + 1;
    });

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

  if (!minutasPorPuestoApp[puesto]) {
    minutasPorPuestoApp[puesto] = [];
  }

  minutasPorPuestoApp[puesto].push(m);
});

const historial = Object.entries(minutasPorPuestoApp).map(([puesto, lista]) => `
  <div class="card">
    <h3 style="cursor:pointer;" onclick="toggleGrupoMinutas('${puesto.replace(/'/g, "\\'")}')">
      📍 ${puesto} (${lista.length}) ⬇
    </h3>

    <div id="grupo-minutas-${puesto.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ-]/g, "")}" style="display:none;">
      ${lista.map(m => {
        const alerta = detectarAlerta(m.novedad);
        const estadoTexto = m.estado || "Pendiente";
        const claseEstado = estadoTexto === "Revisada" ? "estado-revisada" : "";

        return `
          <div class="turno-card ${alerta.clase}">
            <div class="fecha">${m.fecha || ""} - ${m.hora || ""}</div>
            ${alerta.etiqueta ? `<div class="etiqueta">${alerta.etiqueta}</div>` : ""}
            <p><b>Gestor:</b> ${m.gestor || ""}</p>
            <p><b>Tipo:</b> ${m.tipo || ""}</p>
            <p><b>Estado:</b> <span class="${claseEstado}">${estadoTexto}</span></p>
            ${m.revisadaPor ? `<p><b>Revisada por:</b> ${m.revisadaPor}</p>` : ""}
            <p><b>Novedad:</b> ${m.novedad || ""}</p>
            ${m.foto ? `<img class="foto" src="${m.foto}" alt="Foto evidencia">` : ""}

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
`).join("");

    const gestoresSistema = Object.values(usuarios)
      .filter(u => u.rol === "gestor")
      .map(u => u.nombre);

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

const programacionPorGestorSupervisor = Object.entries(usuarios)
  .filter(([usuario, datos]) => datos.rol === "gestor")
  .map(([usuario, datos]) => {
    const lista = asignaciones15Dias.filter(a => a.usuario === usuario);

    const idGestor = usuario
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ-]/g, "");

    return `
      <div class="card">
        <h3 style="cursor:pointer;" onclick="toggleProgramacion('${idGestor}')">
          👤 ${datos.nombre} (${lista.length} días programados) ⬇
        </h3>

        <div id="grupo-programacion-${idGestor}" style="display:none;">
          ${
            lista.length === 0
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
                      <th style="padding:10px;">Acciones</th>
                    </tr>

                    ${lista.map(a => `
                      <tr style="border-bottom:1px solid #ddd;">
                        <td style="padding:10px;">${a.fecha || ""}</td>
                        <td style="padding:10px;">${a.puesto || ""}</td>
                        <td style="padding:10px;">
                          ${a.tipoDia === "Descanso" ? "Descanso" : `${a.horaInicioProgramada || ""} - ${a.horaFinProgramada || ""}`}
                        </td>
                        <td style="padding:10px;">${a.tipoDia || "Turno"}</td>
                        <td style="padding:10px;">${a.motivo || ""}</td>
                        <td style="padding:10px;">
                          <a class="btn btn-warning" href="/editar-asignacion?id=${a._id}">✏️</a>

                          <form method="POST" style="display:inline;">
                            <input type="hidden" name="accion" value="eliminar_asignacion">
                            <input type="hidden" name="id" value="${a._id}">
                            <button class="btn-danger">🗑️</button>
                          </form>
                        </td>
                      </tr>
                    `).join("")}
                  </table>
                </div>
              `
          }
        </div>
      </div>
    `;
  })
  .join("");

    const formularioAsignacion = `
  <div class="panel">
    <h2>📅 Programación avanzada de puestos</h2>
    <p>Desde aquí puedes asignar turnos, descansos o disponibilidad para los próximos 15 días.</p>

<div class="botones no-print" style="margin-bottom:15px;">
  <a class="btn btn-success" href="/programar-rango">📆 Programar varios días</a>
  <a class="btn btn-warning" href="/exportar-programacion-excel">📊 Descargar programación Excel</a>
</div>

    <form method="POST">
      <input type="hidden" name="accion" value="asignar">

      <label>Gestor</label>
      <select name="usuario" required>
        ${Object.entries(usuarios)
          .filter(([usuario, datos]) => datos.rol === "gestor")
          .map(([usuario, datos]) => `<option value="${usuario}">${datos.nombre}</option>`)
          .join("")}
      </select>

      <label>Puesto</label>
      <select name="puesto" required>
        ${puestos.map(p => `<option>${p}</option>`).join("")}
      </select>

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

    ${
      asignaciones15Dias.length === 0
        ? "<p>No hay programación registrada para los próximos 15 días.</p>"
        : programacionPorGestorSupervisor
    }
  </div>
`;

    const dashboardSupervisor = `
      <div class="panel">
        <h2>📊 Dashboard Gerencial</h2>

        <div class="dashboard">
          <div class="metric">
            <p>Novedades hoy</p>
            <strong>${minutasHoy}</strong>
          </div>

          <div class="metric">
            <p>Novedades del mes</p>
            <strong>${minutasMes}</strong>
          </div>

          <div class="metric">
            <p>Pendientes</p>
            <strong>${pendientes}</strong>
          </div>

          <div class="metric">
            <p>Puestos activos</p>
            <strong>${puestosActivos}</strong>
          </div>
        </div>

        <h3>Por puesto</h3>
        ${Object.entries(porPuesto).map(([p, c]) => `<p>${p}: <b>${c}</b></p>`).join("") || "<p>Sin datos</p>"}

        <h3>Por gestor</h3>
        ${Object.entries(porGestor).map(([g, c]) => `<p>${g}: <b>${c}</b></p>`).join("") || "<p>Sin datos</p>"}

        <h3>Total de horas trabajadas por gestor</h3>
        ${Object.entries(horasPorGestor).map(([g, h]) => `<p>${g}: <b>${Number(h).toFixed(2)} horas</b></p>`).join("") || "<p>Sin turnos cerrados todavía.</p>"}
      </div>
    `;

    const gestoresTurnoHTML = `
      <div class="panel">
        <h2>👷 Gestores en turno</h2>
        ${
          turnosActivos.length === 0
            ? "<p>No hay gestores en turno.</p>"
            : turnosActivos.map(t => `
              <div class="turno-card">
                <p><b>${t.gestor}</b></p>
                <p><b>Puesto:</b> ${t.puesto}</p>
                <p><b>Fecha:</b> ${t.fecha || ""}</p>
                <p><b>Entrada:</b> ${t.horaEntrada || ""}</p>
<p><b>Tipo de turno:</b> ${t.tipoTurno || "No registrado"}</p>
                <p><b>Estado:</b> <span class="estado-activo">${t.estado}</span></p>
              </div>
            `).join("")
        }
      </div>
    `;

    const turnosPorGestor = {};

turnosCerrados.forEach(t => {
  const gestor = t.gestor || "Sin gestor";

  if (!turnosPorGestor[gestor]) {
    turnosPorGestor[gestor] = [];
  }

  turnosPorGestor[gestor].push(t);
});

const historialTurnosHTML = `
  <div class="panel">
    <h2>🕒 Historial de turnos cerrados por gestor</h2>

    ${
      Object.keys(turnosPorGestor).length === 0
        ? "<p>No hay turnos cerrados todavía.</p>"
        : Object.entries(turnosPorGestor).map(([gestor, lista]) => {
            const totalHoras = lista.reduce((acc, t) => acc + (Number(t.horasTrabajadas) || 0), 0);

            const idGestor = gestor
              .replace(/\s+/g, "-")
              .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ-]/g, "");

            return `
              <div class="card">
                <h3 style="cursor:pointer;" onclick="toggleTurnos('${idGestor}')">
                  👤 ${gestor} (${lista.length} turnos) ⬇
                </h3>

                <div id="grupo-turnos-${idGestor}" style="display:none;">
                  ${lista.map(t => `
                    <div class="turno-card">
                      <p><b>Puesto:</b> ${t.puesto || ""}</p>
                      <p><b>Entrada:</b> ${t.fecha || ""} - ${t.horaEntrada || ""}</p>
                      <p><b>Salida:</b> ${t.fechaSalida || ""} - ${t.horaSalida || ""}</p>
                      <p><b>Tiempo trabajado:</b> ${t.tiempoTrabajado || `${t.horasTrabajadas || 0} horas`}</p>
                      <p><b>Horario programado:</b> ${t.horarioProgramado || "Sin horario"}</p>
                      <p><b>Cumplimiento:</b> ${t.estadoCumplimiento || "No analizado"}</p>
                      <p><b>Detalle:</b> ${t.resumenCumplimiento || ""}</p>
                      <p><b>Estado:</b> ${t.estado || ""}</p>
                    </div>
                  `).join("")}

                  <div class="contador">
                    Total de horas trabajadas: ${totalHoras.toFixed(2)} horas
                  </div>
                </div>
              </div>
            `;
          }).join("")
    }
  </div>
`;

  const programacionGestorHTML = `
  <div class="panel">
    <h2>📆 Mi programación próximos 15 días</h2>

    ${
      miProgramacion15Dias.length === 0
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
        `
    }
  </div>
`;

    const formularioGestor = `
      ${
        miTurnoActivo
          ? `
            <div class="panel">
              <h2>🟢 Turno activo</h2>
              <p><b>Gestor:</b> ${miTurnoActivo.gestor}</p>
              <p><b>Puesto:</b> ${miTurnoActivo.puesto}</p>
              <p><b>Fecha:</b> ${miTurnoActivo.fecha || ""}</p>
              <p><b>Hora entrada:</b> ${miTurnoActivo.horaEntrada || ""}</p>
<p><b>Tipo de turno:</b> ${miTurnoActivo.tipoTurno || "No registrado"}</p>
              <p><b>Estado:</b> <span class="estado-activo">${miTurnoActivo.estado}</span></p>

              <form method="POST" action="/cerrar-turno" onsubmit="return confirm('¿Seguro que deseas cerrar tu turno?');" style="box-shadow:none;padding:0;margin-top:10px;">
                <button class="btn-danger" type="submit">🔴 Cerrar turno</button>
              </form>
            </div>
          `
          : `
            <form method="POST" action="/iniciar-turno">
              <label>Iniciar turno</label>

              <select name="puesto" required>
                ${opcionesPuestos}
              </select>

              <button type="submit">🟢 Iniciar turno</button>
            </form>
          `
      }

      <form method="POST" action="/guardar" enctype="multipart/form-data">
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

        <button type="submit">Guardar minuta</button>
      </form>
    `;

    enviarHTML(res, `
      <html>
     <head>
  <title>Minuta Consotá</title>
  ${estilos}

  <script>
    function normalizarId(texto) {
      return String(texto)
        .replace(/\\s+/g, "-")
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ-]/g, "");
    }

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
  </script>
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

  enviarHTML(res, `
    <html>
    <head>
      <title>Login Minuta Consotá</title>
      ${estilos}
    </head>

    <body class="login-body">
      <form class="login-card" method="POST">
        <div class="logo">CF</div>

        <h1 class="marca">Minuta Consotá</h1>
        <div class="submarca">Comfamiliar Risaralda</div>

        <input type="hidden" name="accion" value="login">

        <label>Usuario</label>
        <input name="usuario" required placeholder="Ej: jaider">

        <label>Contraseña</label>
        <input name="clave" type="password" required placeholder="Ingresa tu clave">

        <button type="submit">Ingresar</button>
      </form>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor corriendo en puerto " + PORT);
});