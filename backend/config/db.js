const mysql = require("mysql2");

function readDbConfig() {
  const host =
    process.env.DB_HOST ||
    process.env.MYSQLHOST ||
    "localhost";
  const user =
    process.env.DB_USER ||
    process.env.MYSQLUSER ||
    "root";
  const password =
    process.env.DB_PASSWORD ||
    process.env.MYSQLPASSWORD ||
    "";
  const database =
    process.env.DB_NAME ||
    process.env.MYSQLDATABASE ||
    "gestion_hotel";
  const port = Number(
    process.env.DB_PORT || process.env.MYSQLPORT || 3306
  );
  const useSsl =
    process.env.DB_SSL === "true" ||
    (host.includes(".proxy.rlwy.net") && process.env.DB_SSL !== "false");

  return { host, user, password, database, port, useSsl };
}

const cfg = readDbConfig();

const db = mysql.createPool({
  host: cfg.host,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  port: cfg.port,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: cfg.useSsl ? { rejectUnauthorized: false } : undefined
});

db.getConnection((err, connection) => {
  if (err) {
    console.log("Erreur connexion DB :", err.message);
    console.log("DB cible :", cfg.host, cfg.port, cfg.database);
  } else {
    console.log("Connecté à MySQL ✔", cfg.database);
    connection.release();
  }
});
module.exports = db;