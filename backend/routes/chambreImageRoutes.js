const express = require("express");
const router = express.Router();
const db = require("../config/db");
const verifierToken = require("../middleware/authMiddleware");
const { saveChambreImage, deleteRelFile } = require("../utils/hotelImageStorage");

function assertProprietaire(req, res) {
  if (req.user.role !== "proprietaire") {
    res.status(403).send("Accès réservé aux propriétaires");
    return false;
  }
  return true;
}

function getOwnedChambre(chambreId, ownerId, callback) {
  db.query(
    `SELECT c.*, h.id_proprietaire
     FROM chambres c
     JOIN hotels h ON h.id = c.id_hotel
     WHERE c.id = ? AND h.id_proprietaire = ?`,
    [chambreId, ownerId],
    (err, rows) => {
      if (err) return callback(err);
      if (!rows.length) return callback(null, null);
      callback(null, rows[0]);
    }
  );
}

router.post("/chambres/:id/images", verifierToken, (req, res) => {
  if (!assertProprietaire(req, res)) return;

  const chambreId = req.params.id;
  const items = Array.isArray(req.body.images) ? req.body.images : [req.body];

  getOwnedChambre(chambreId, req.user.id, (err, chambre) => {
    if (err) return res.status(500).send("Erreur serveur");
    if (!chambre) return res.status(403).send("Chambre introuvable ou non autorisée");

    const saved = [];
    try {
      items.forEach((item, index) => {
        const chemin = saveChambreImage(chambreId, item, `galerie-${index}`);
        saved.push({ chemin, ordre: index });
      });
    } catch (e) {
      saved.forEach(s => deleteRelFile(s.chemin));
      return res.status(400).send(e.message);
    }

    if (!saved.length) {
      return res.status(400).send("Aucune image fournie");
    }

    const values = saved.map(s => [chambreId, s.chemin, s.ordre]);

    db.query(
      "INSERT INTO chambre_images (id_chambre, chemin, ordre) VALUES ?",
      [values],
      (err2, result) => {
        if (err2) {
          saved.forEach(s => deleteRelFile(s.chemin));
          return res.status(500).send("Erreur serveur");
        }

        res.status(201).json({
          message: `${saved.length} image(s) ajoutée(s)`,
          images: saved.map((s, i) => ({
            id: result.insertId + i,
            chemin: s.chemin,
            ordre: s.ordre
          }))
        });
      }
    );
  });
});

router.get("/chambres/:id/images", (req, res) => {
  const chambreId = req.params.id;

  db.query(
    `SELECT id, chemin, ordre, created_at
     FROM chambre_images
     WHERE id_chambre = ?
     ORDER BY ordre ASC, id ASC`,
    [chambreId],
    (err, rows) => {
      if (err) return res.status(500).send("Erreur serveur");
      res.json(rows);
    }
  );
});

router.delete("/chambres/images/:imageId", verifierToken, (req, res) => {
  if (!assertProprietaire(req, res)) return;

  const imageId = req.params.imageId;

  db.query(
    `SELECT ci.*, h.id_proprietaire
     FROM chambre_images ci
     JOIN chambres c ON c.id = ci.id_chambre
     JOIN hotels h ON h.id = c.id_hotel
     WHERE ci.id = ?`,
    [imageId],
    (err, rows) => {
      if (err) return res.status(500).send("Erreur serveur");
      if (!rows.length) return res.status(404).send("Image introuvable");
      if (rows[0].id_proprietaire !== req.user.id) {
        return res.status(403).send("Non autorisé");
      }

      const chemin = rows[0].chemin;

      db.query("DELETE FROM chambre_images WHERE id = ?", [imageId], err2 => {
        if (err2) return res.status(500).send("Erreur serveur");
        deleteRelFile(chemin);
        res.send("Image supprimée");
      });
    }
  );
});

module.exports = router;
