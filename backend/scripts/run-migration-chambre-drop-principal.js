const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const sqlPath = path.join(__dirname, "../database/migration_chambre_drop_image_principale.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const statements = sql
  .replace(/--[^\n]*/g, "")
  .split(";")
  .map(s => s.trim())
  .filter(s => s.length > 0);

function runNext(i) {
  if (i >= statements.length) {
    console.log("Migration drop image_principale chambre terminée.");
    process.exit(0);
    return;
  }

  db.query(statements[i], err => {
    if (err) {
      if (err.code === "ER_CANT_DROP_FIELD_OR_KEY") {
        console.log("Colonne image_principale déjà absente.");
        return runNext(i + 1);
      }
      console.error("Erreur:", err.message);
      process.exit(1);
    }
    console.log("OK:", statements[i].slice(0, 60) + "...");
    runNext(i + 1);
  });
}

runNext(0);
