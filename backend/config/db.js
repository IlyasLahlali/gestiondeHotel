const mysql = require("mysql2");

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : value;
}

function parseDatabaseUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const database = url.pathname.replace(/^\//, "") || "railway";
    return {
      host: url.hostname,
      port: Number(url.port) || 3306,
      user: decodeURIComponent(url.username || "root"),
      password: decodeURIComponent(url.password || ""),
      database,
      useSsl: true
    };
  } catch {
    return null;
  }
}

function readDbConfig() {
  const urlConfig =
    parseDatabaseUrl(trimEnv(process.env.DATABASE_URL)) ||
    parseDatabaseUrl(trimEnv(process.env.MYSQL_PUBLIC_URL)) ||
    parseDatabaseUrl(trimEnv(process.env.MYSQL_URL));

  if (urlConfig) return urlConfig;

  const host = trimEnv(
    process.env.DB_HOST || process.env.MYSQLHOST || "localhost"
  );
  const user = trimEnv(
    process.env.DB_USER || process.env.MYSQLUSER || "root"
  );
  const password = trimEnv(
    process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || ""
  );
  const database = trimEnv(
    process.env.DB_NAME || process.env.MYSQLDATABASE || "gestion_hotel"
  );
  const port = Number(
    trimEnv(process.env.DB_PORT || process.env.MYSQLPORT || 3306)
  );

  const isPublicProxy =
    host.includes(".proxy.rlwy.net") || host.endsWith(".rlwy.net");
  const isInternal = host.includes(".railway.internal");

  // Railway public proxy exige SSL ; internal non
  let useSsl = false;
  if (isPublicProxy) {
    useSsl = true;
  } else if (process.env.DB_SSL === "true") {
    useSsl = true;
  } else if (!isInternal && process.env.DB_SSL !== "false") {
    useSsl = false;
  }

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
  connectTimeout: 15000,
  ssl: cfg.useSsl ? { rejectUnauthorized: false } : undefined
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("Erreur connexion DB :", err.message, err.code || "");
    console.error("DB cible :", cfg.host, cfg.port, cfg.database, "ssl=", cfg.useSsl);
  } else {
    console.log("Connecté à MySQL ✔", cfg.database);
    connection.release();
  }
});

module.exports = db;
