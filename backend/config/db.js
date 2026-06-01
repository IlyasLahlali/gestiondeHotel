const mysql = require("mysql2");

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "gestion_hotel",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

db.getConnection((err, connection) => {
  if (err) {
    console.log("Erreur connexion DB :", err.message);
  } else {
    console.log("Connecté à MySQL ✔");
    connection.release();
  }
});

module.exports = db;