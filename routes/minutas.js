async function marcarRevisada(form, db, sesion, res) {
  const { ObjectId } = require("mongodb");

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
}

async function eliminarMinuta(form, db, res) {
  const { ObjectId } = require("mongodb");

  const id = form.get("id");

  await db.collection("minutas").deleteOne({
    _id: new ObjectId(id)
  });

  res.writeHead(302, { Location: "/app" });
  res.end();
}

async function actualizarMinuta(form, db, res) {
  const { ObjectId } = require("mongodb");

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
}

async function guardarMinuta(req, db, sesion, res, cloudinary, fs) {
  try {
    let fotoUrl = "";

    if (req.file) {
      const resultado = await cloudinary.uploader.upload(req.file.path, {
        folder: "minutas-consota"
      });
      fotoUrl = resultado.secure_url;

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
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
    res.end("Error guardando minuta");
  }
}

module.exports = {
  marcarRevisada,
  eliminarMinuta,
  actualizarMinuta,
  guardarMinuta
};