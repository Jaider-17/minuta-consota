const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const archivo = "minutas.json";

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

  wilmar: { clave: "admin123", nombre: "Wilmar", rol: "supervisor" },
  jhoneider: { clave: "admin123", nombre: "Jhoneider", rol: "supervisor" },
  adreina: { clave: "admin123", nombre: "Adreina", rol: "supervisor" },
  gerencia: { clave: "admin123", nombre: "Gerencia", rol: "supervisor" }
};
const puestos = [
  "Taquilla Consotá",
  "Pereira Antigua",
  "Granja",
  "Clínica",
  "Portería",
  "Otro"
];

const sesiones = {};

function leerMinutas() {
  if (fs.existsSync(archivo)) {
    return JSON.parse(fs.readFileSync(archivo, "utf8"));
  }
  return [];
}

function guardarMinutas(minutas) {
  fs.writeFileSync(archivo, JSON.stringify(minutas, null, 2), "utf8");
}

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
    max-width: 950px;
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

  button {
    background: #005baa;
    color: white;
    padding: 14px;
    width: 100%;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
    font-weight: bold;
  }

  button:hover { background: #003f7d; }

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
    max-width: 320px;
    border-radius: 12px;
    margin-top: 10px;
    border: 1px solid #ddd;
  }
</style>
`;

const server = http.createServer((req, res) => {
  const cookies = getCookies(req);
  const sessionId = cookies.sessionId;
  const sesion = sesiones[sessionId];

  if (req.method === "POST" && req.url === "/guardar") {
    if (!sesion) {
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

          fs.unlinkSync(req.file.path);
        }

        const minuta = {
          fecha: new Date().toLocaleString("es-CO"),
          usuario: sesion.usuario,
          gestor: sesion.nombre,
          puesto: req.body.puesto,
          tipo: req.body.tipo,
          novedad: req.body.novedad,
          foto: fotoUrl
        };

        const minutas = leerMinutas();
        minutas.push(minuta);
        guardarMinutas(minutas);

        res.writeHead(302, { Location: "/app" });
        res.end();
      } catch (error) {
        enviarHTML(res, `<h1>Error guardando la foto ❌</h1><a href="/app">Volver</a>`);
      }
    });

    return;
  }

  if (req.method === "POST") {
    let datos = "";

    req.on("data", parte => datos += parte);

    req.on("end", () => {
      const form = new URLSearchParams(datos);
      const accion = form.get("accion");

      if (accion === "login") {
        const usuario = form.get("usuario").toLowerCase();
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

  if (req.url === "/app") {
    if (!sesion) {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

  let minutas = leerMinutas();

const url = new URL(req.url, "http://localhost:3000");

const filtroPuesto = url.searchParams.get("puesto") || "";
const filtroGestor = url.searchParams.get("gestor") || "";
const filtroFecha = url.searchParams.get("fecha") || "";

if (sesion.rol === "gestor") {
  minutas = minutas.filter(m => m.usuario === sesion.usuario);
}

if (sesion.rol === "supervisor") {
  if (filtroPuesto) {
    minutas = minutas.filter(m => m.puesto === filtroPuesto);
  }

  if (filtroGestor) {
    minutas = minutas.filter(m => m.gestor === filtroGestor);
  }

  if (filtroFecha) {
    minutas = minutas.filter(m => m.fecha && m.fecha.includes(filtroFecha));
  }
}

    const opcionesPuestos = puestos.map(p => `<option>${p}</option>`).join("");

    const historial = minutas.reverse().map(m => `
      <div class="card">
        <div class="fecha">${m.fecha}</div>
        <h3>${m.puesto}</h3>
        <p><b>Gestor:</b> ${m.gestor}</p>
        <p><b>Tipo:</b> ${m.tipo}</p>
        <p><b>Novedad:</b> ${m.novedad}</p>
        ${m.foto ? `<img class="foto" src="${m.foto}" alt="Foto evidencia">` : ""}
      </div>
    `).join("");

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
          ${sesion.rol === "supervisor" ? `
  <form method="GET" action="/app">
    <h2>Filtros de supervisor</h2>

    <label>Filtrar por puesto</label>
    <select name="puesto">
      <option value="">Todos</option>
      <option>Taquilla Consotá</option>
      <option>Pereira Antigua</option>
      <option>Granja</option>
      <option>Clínica</option>
      <option>Portería</option>
      <option>Otro</option>
    </select>

    <label>Filtrar por gestor</label>
    <select name="gestor">
      <option value="">Todos</option>
      <option>Jaider García</option>
      <option>Jeferson</option>
    </select>

    <label>Filtrar por fecha</label>
    <input type="text" name="fecha" placeholder="Ej: 25/4/2026">

    <button type="submit">Aplicar filtros</button>
  </form>

  <a href="/app">Quitar filtros</a>
` : ""}
            <form method="POST" action="/guardar" enctype="multipart/form-data">
              <label>Gestor</label>
              <input value="${sesion.nombre}" readonly>

              <label>Puesto del turno</label>
              <select name="puesto" required>
                ${opcionesPuestos}
              </select>

              <label>Tipo de registro</label>
              <select name="tipo" required>
                <option>Inicio de turno</option>
                <option>Ronda</option>
                <option>Novedad</option>
                <option>Entrega de turno</option>
                <option>Emergencia</option>
                <option>Daño</option>
              </select>

              <label>Novedad</label>
              <textarea name="novedad" required placeholder="Escribe aquí lo ocurrido..."></textarea>

              <label>Foto evidencia</label>
              <input type="file" name="foto" accept="image/*" capture="environment">

              <button type="submit">Guardar minuta</button>
            </form>
          ` : `
            <div class="panel">
              <h2>Panel Supervisor</h2>
              <p>Aquí puedes ver todas las minutas registradas por todos los gestores.</p>
            </div>
          `}

          <h2>Historial de minutas</h2>
          ${historial || "<p>No hay minutas guardadas todavía.</p>"}

          <a class="cerrar" href="/logout">Cerrar sesión</a>
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor corriendo en puerto " + PORT);
});