const express = require("express");
const router = express.Router();
const db = require("../config/db");
const verifierToken = require("../middleware/authMiddleware");

function requireClient(req, res) {
  if (req.user.role !== "client") {
    res.status(403).json({ message: "Accès refusé : client seulement" });
    return false;
  }
  return true;
}

router.get("/favoris/ids", verifierToken, (req, res) => {
  if (!requireClient(req, res)) return;

  db.query(
    "SELECT id_hotel FROM favoris WHERE id_client = ?",
    [req.user.id],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      res.json({ ids: rows.map(r => r.id_hotel) });
    }
  );
});

router.get("/favoris", verifierToken, (req, res) => {
  if (!requireClient(req, res)) return;

  const sql = `
    SELECT
      h.id,
      h.nom,
      h.ville,
      h.adresse,
      h.description,
      h.image_principale,
      f.created_at AS favori_le,
      (
        SELECT MIN(c.prix)
        FROM chambres c
        WHERE c.id_hotel = h.id
      ) AS prix_min,
      (
        SELECT COUNT(*)
        FROM chambres c
        WHERE c.id_hotel = h.id
      ) AS nb_chambres
    FROM favoris f
    INNER JOIN hotels h ON h.id = f.id_hotel
    WHERE f.id_client = ? AND h.statut = 'valide'
    ORDER BY f.created_at DESC
  `;

  db.query(sql, [req.user.id], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Erreur serveur" });
    }

    res.json(rows);
  });
});

router.post("/favoris/:hotelId", verifierToken, (req, res) => {
  if (!requireClient(req, res)) return;

  const hotelId = Number(req.params.hotelId);
  if (!hotelId) {
    return res.status(400).json({ message: "Hôtel invalide" });
  }

  db.query(
    "SELECT id FROM hotels WHERE id = ? AND statut = 'valide' LIMIT 1",
    [hotelId],
    (err, hotels) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      if (!hotels.length) {
        return res.status(404).json({ message: "Hôtel introuvable" });
      }

      db.query(
        "INSERT IGNORE INTO favoris (id_client, id_hotel) VALUES (?, ?)",
        [req.user.id, hotelId],
        insertErr => {
          if (insertErr) {
            console.error(insertErr);
            return res.status(500).json({ message: "Erreur serveur" });
          }

          res.status(201).json({ message: "Ajouté aux favoris", id_hotel: hotelId });
        }
      );
    }
  );
});

router.delete("/favoris/:hotelId", verifierToken, (req, res) => {
  if (!requireClient(req, res)) return;

  const hotelId = Number(req.params.hotelId);
  if (!hotelId) {
    return res.status(400).json({ message: "Hôtel invalide" });
  }

  db.query(
    "DELETE FROM favoris WHERE id_client = ? AND id_hotel = ?",
    [req.user.id, hotelId],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Favori introuvable" });
      }

      res.json({ message: "Retiré des favoris", id_hotel: hotelId });
    }
  );
});

module.exports = router;
