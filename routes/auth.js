function manejarLogin(form, res, { usuarios, sesiones, enviarHTML, vistaErrorLogin, estilos, crypto }) {
  const usuario = (form.get("usuario") || "").toLowerCase();
  const clave = form.get("clave");

  if (!usuarios[usuario] || usuarios[usuario].clave !== clave) {
    enviarHTML(res, vistaErrorLogin(estilos));
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
}

function manejarLogout(req, res, { sesiones }) {
  const cookies = req.headers.cookie || "";
  const partes = cookies.split(";").find(c => c.trim().startsWith("sessionId="));

  if (partes) {
    const sessionId = partes.split("=")[1];
    if (sessionId) delete sesiones[sessionId];
  }

  res.writeHead(302, {
    "Set-Cookie": "sessionId=; Max-Age=0; Path=/",
    Location: "/"
  });

  res.end();
}

module.exports = {
  manejarLogin,
  manejarLogout
};