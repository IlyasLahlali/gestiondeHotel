const db = require("../config/db");

db.query("SHOW COLUMNS FROM hotels LIKE 'image_principale'", (err, rows) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log(rows.length ? "OK: colonne image_principale existe" : "MANQUANT: colonne image_principale");
  process.exit(rows.length ? 0 : 1);
});
