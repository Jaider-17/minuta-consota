const { MongoClient } = require("mongodb");

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  throw new Error("Falta la variable de entorno MONGO_URL");
}

const client = new MongoClient(MONGO_URL);

let db;

async function conectarDB() {
  if (db) return db;

  await client.connect();
  db = client.db("minutasDB");
  console.log("🔥 Conectado a MongoDB");

  return db;
}

module.exports = {
  conectarDB
};