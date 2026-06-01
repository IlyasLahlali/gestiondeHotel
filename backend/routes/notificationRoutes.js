const express = require("express");
const router = express.Router();
const db = require("../config/db");
const verifierToken = require("../middleware/authMiddleware");

function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbExecute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

router.get("/notifications/unread-count", verifierToken, async (req, res) => {
  try {
    const rows = await dbQuery(
      "SELECT COUNT(*) AS total FROM notifications WHERE id_utilisateur = ? AND lue = 0",
      [req.user.id]
    );
    res.json({ count: rows[0]?.total || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/notifications", verifierToken, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 50);
    const rows = await dbQuery(
      `SELECT id, type, titre, message, lien, id_hotel, id_reservation, lue, created_at
       FROM notifications
       WHERE id_utilisateur = ?
       ORDER BY lue ASC, created_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.put("/notifications/lire-tout", verifierToken, async (req, res) => {
  try {
    await dbExecute(
      "UPDATE notifications SET lue = 1 WHERE id_utilisateur = ? AND lue = 0",
      [req.user.id]
    );
    res.json({ message: "Toutes les notifications sont lues" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.put("/notifications/:id/lire", verifierToken, async (req, res) => {
  try {
    const result = await dbExecute(
      "UPDATE notifications SET lue = 1 WHERE id = ? AND id_utilisateur = ?",
      [req.params.id, req.user.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Notification introuvable" });
    }
    res.json({ message: "Notification lue" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
