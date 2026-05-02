async function iniciarTurno(form, db, sesion, res, helpers) {
  const {
    fechaColombia,
    obtenerTipoTurno,
    enviarHTML,
    estilos
  } = helpers;

  const puesto = form.get("puesto");
  const { fecha, hora, fechaFiltro } = fechaColombia();

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
}

module.exports = {
  iniciarTurno
};