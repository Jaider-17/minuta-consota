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

module.exports = {
  marcarRevisada,
  eliminarMinuta,
  actualizarMinuta
};