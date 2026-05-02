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

module.exports = {
  marcarRevisada
};