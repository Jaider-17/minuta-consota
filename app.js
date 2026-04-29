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
function calcularHoras(inicio, fin) {
  const diferenciaMs = fin - inicio;
  const horas = diferenciaMs / (1000 * 60 * 60);
  return Number(horas.toFixed(2));
}
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

function novadadSeguro(texto = "") {
  return String(texto || "").toLowerCase();
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

  .botones a, .botones button {
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

  if (req.url.startsWith("/exportar-pdf")) {
    if (!sesion || sesion.rol !== "supervisor") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const minutas = await obtenerMinutasFiltradas(url, sesion);

    const contenido = minutas.map(m => `
      <div class="card">
        <div class="fecha">${m.fecha || ""} - ${m.hora || ""}</div>
        <h3>${m.puesto || ""}</h3>
        <p><b>Gestor:</b> ${m.gestor || ""}</p>
        <p><b>Tipo:</b> ${m.tipo || ""}</p>
        <p><b>Estado:</b> ${m.estado || "Pendiente"}</p>
        <p><b>Novedad:</b> ${m.novedad || ""}</p>
        ${m.foto ? `<p><b>Foto:</b> ${m.foto}</p>` : ""}
      </div>
    `).join("");

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

  const { fecha, hora, fechaFiltro } = fechaColombia();

  const turnoActivo = await db.collection("turnos").findOne({
    usuario: sesion.usuario,
    estado: "Activo"
  });

  if (!turnoActivo) {
    res.writeHead(302, { Location: "/app" });
    res.end();
    return;
  }

  const entrada = turnoActivo.creadoEn ? new Date(turnoActivo.creadoEn) : new Date();
  const salida = new Date();
  const horasTrabajadas = calcularHoras(entrada, salida);

  await db.collection("turnos").updateOne(
    { _id: turnoActivo._id },
    {
      $set: {
        fechaSalida: fecha,
        fechaSalidaFiltro: fechaFiltro,
        horaSalida: hora,
        estado: "Cerrado",
        cerradoEn: salida,
        horasTrabajadas
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
        estado: "Revisada"
      }
    }
  );

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
const miTurnoActivo = await db.collection("turnos").findOne({
  usuario: sesion.usuario,
  estado: "Activo"
});


    const opcionesPuestos = puestos.map(p => `<option>${p}</option>`).join("");

    const totalMinutas = minutas.length;
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

    const historial = [...minutas].reverse().map(m => {
      const alerta = detectarAlerta(m.novedad);

      return `
        <div class="card ${alerta.clase}">
          <div class="fecha">${m.fecha || ""} - ${m.hora || ""}</div>
          <h3>${m.puesto || ""}</h3>
          ${alerta.etiqueta ? `<div class="etiqueta">${alerta.etiqueta}</div>` : ""}
          <p><b>Gestor:</b> ${m.gestor || ""}</p>
          <p><b>Tipo:</b> ${m.tipo || ""}</p>
          <p><b>Estado:</b> ${m.estado || "Pendiente"}</p>
          <p><b>Novedad:</b> ${m.novedad || ""}</p>
          ${m.foto ? `<img class="foto" src="${m.foto}" alt="Foto evidencia">` : ""}

          ${sesion.rol === "supervisor" ? `
            <div class="botones no-print" style="margin-top:10px;">
              <a class="btn btn-warning" href="/editar?id=${m._id}">✏️ Editar</a>
${(m.estado || "Pendiente") === "Pendiente" ? `
  <form method="POST" style="box-shadow:none;padding:0;margin:0;">
    <input type="hidden" name="accion" value="revisada">
    <input type="hidden" name="id" value="${m._id}">
    <button type="submit">✅ Marcar revisada</button>
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
    }).join("");

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
                <p><b>Estado:</b> <span class="estado-activo">${t.estado}</span></p>
              </div>
            `).join("")
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
      </head>

      <body>
        <header>
          <div class="logo">CF</div>
          <h1>Minuta Digital Consotá</h1>
          <p>${sesion.nombre} | ${sesion.rol}</p>
        </header>

        <div class="contenedor">
          ${sesion.rol === "supervisor" ? filtrosSupervisor : ""}
          ${sesion.rol === "supervisor" ? dashboardSupervisor + gestoresTurnoHTML : ""}
          ${sesion.rol === "gestor" ? formularioGestor : `
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