const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function main() {
  const sqlPath = path.join(__dirname, "..", "database", "migration_google_auth.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--") && s.toUpperCase() !== "USE GESTION_HOTEL");

  const conn = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "gestion_hotel",
    multipleStatements: true
  });

  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      console.log("OK:", stmt.slice(0, 60) + "...");
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log("Déjà appliqué:", stmt.slice(0, 50));
      } else {
        throw err;
      }
    }
  }

  await conn.end();
  console.log("Migration Google terminée.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
