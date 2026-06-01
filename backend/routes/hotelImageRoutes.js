const express = require("express");
const router = express.Router();
const db = require("../config/db");
const verifierToken = require("../middleware/authMiddleware");
const { saveHotelImage, deleteRelFile } = require("../utils/hotelImageStorage");

function assertProprietaire(req, res) {
  if (req.user.role !== "proprietaire") {
    res.status(403).send("Accès réservé aux propriétaires");
    return false;
  }
  return true;
}

function getOwnedHotel(hotelId, ownerId, callback) {
  db.query(
    "SELECT * FROM hotels WHERE id = ? AND id_proprietaire = ?",
    [hotelId, ownerId],
    (err, rows) => {
      if (err) return callback(err);
      if (!rows.length) return callback(null, null);
      callback(null, rows[0]);
    }
  );
}

// Image principale
router.post("/hotels/:id/image-principale", verifierToken, (req, res) => {
  if (!assertProprietaire(req, res)) return;

  const hotelId = req.params.id;

  getOwnedHotel(hotelId, req.user.id, (err, hotel) => {
    if (err) return res.status(500).send("Erreur serveur");
    if (!hotel) return res.status(403).send("Hôtel introuvable ou non autorisé");

    let chemin;
    try {
      chemin = saveHotelImage(hotelId, req.body, "principale");
    } catch (e) {
      return res.status(400).send(e.message);
    }

    if (hotel.image_principale) {
      deleteRelFile(hotel.image_principale);
    }

    db.query(
      "UPDATE hotels SET image_principale = ? WHERE id = ?",
      [chemin, hotelId],
      err2 => {
        if (err2) return res.status(500).send("Erreur serveur");
        res.json({ message: "Image principale enregistrée", image_principale: chemin });
      }
    );
  });
});

// Galerie — ajouter une ou plusieurs images
router.post("/hotels/:id/images", verifierToken, (req, res) => {
  if (!assertProprietaire(req, res)) return;

  const hotelId = req.params.id;
  const items = Array.isArray(req.body.images) ? req.body.images : [req.body];

  getOwnedHotel(hotelId, req.user.id, (err, hotel) => {
    if (err) return res.status(500).send("Erreur serveur");
    if (!hotel) return res.status(403).send("Hôtel introuvable ou non autorisé");

    const saved = [];
    try {
      items.forEach((item, index) => {
        const chemin = saveHotelImage(hotelId, item, `galerie-${index}`);
        saved.push({ chemin, ordre: index });
      });
    } catch (e) {
      saved.forEach(s => deleteRelFile(s.chemin));
      return res.status(400).send(e.message);
    }

    if (!saved.length) {
      return res.status(400).send("Aucune image fournie");
    }

    const values = saved.map(s => [hotelId, s.chemin, s.ordre]);

    db.query(
      "INSERT INTO hotel_images (id_hotel, chemin, ordre) VALUES ?",
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

// Liste images d'un hôtel (public)
router.get("/hotels/:id/images", (req, res) => {
  const hotelId = req.params.id;

  db.query(
    `SELECT id, chemin, ordre, created_at
     FROM hotel_images
     WHERE id_hotel = ?
     ORDER BY ordre ASC, id ASC`,
    [hotelId],
    (err, rows) => {
      if (err) return res.status(500).send("Erreur serveur");
      res.json(rows);
    }
  );
});

// Supprimer une image de la galerie
router.delete("/hotels/images/:imageId", verifierToken, (req, res) => {
  if (!assertProprietaire(req, res)) return;

  const imageId = req.params.imageId;

  db.query(
    `SELECT hi.*, h.id_proprietaire, h.image_principale
     FROM hotel_images hi
     JOIN hotels h ON h.id = hi.id_hotel
     WHERE hi.id = ?`,
    [imageId],
    (err, rows) => {
      if (err) return res.status(500).send("Erreur serveur");
      if (!rows.length) return res.status(404).send("Image introuvable");
      if (rows[0].id_proprietaire !== req.user.id) {
        return res.status(403).send("Non autorisé");
      }

      const chemin = rows[0].chemin;
      const hotelId = rows[0].id_hotel;

      db.query("DELETE FROM hotel_images WHERE id = ?", [imageId], err2 => {
        if (err2) return res.status(500).send("Erreur serveur");

        deleteRelFile(chemin);

        if (rows[0].image_principale === chemin) {
          db.query(
            "UPDATE hotels SET image_principale = NULL WHERE id = ?",
            [hotelId]
          );
        }

        res.send("Image supprimée");
      });
    }
  );
});

// Image principale — suppression
router.delete("/hotels/:id/image-principale", verifierToken, (req, res) => {
  if (!assertProprietaire(req, res)) return;

  const hotelId = req.params.id;

  getOwnedHotel(hotelId, req.user.id, (err, hotel) => {
    if (err) return res.status(500).send("Erreur serveur");
    if (!hotel) return res.status(403).send("Hôtel introuvable ou non autorisé");
    if (!hotel.image_principale) return res.send("Aucune image principale");

    deleteRelFile(hotel.image_principale);

    db.query(
      "UPDATE hotels SET image_principale = NULL WHERE id = ?",
      [hotelId],
      err2 => {
        if (err2) return res.status(500).send("Erreur serveur");
        res.send("Image principale supprimée");
      }
    );
  });
});

// Définir une image de galerie comme principale
router.put("/hotels/:id/image-principale/:imageId", verifierToken, (req, res) => {
  if (!assertProprietaire(req, res)) return;

  const hotelId = req.params.id;
  const imageId = req.params.imageId;

  getOwnedHotel(hotelId, req.user.id, (err, hotel) => {
    if (err) return res.status(500).send("Erreur serveur");
    if (!hotel) return res.status(403).send("Hôtel introuvable ou non autorisé");

    db.query(
      "SELECT chemin FROM hotel_images WHERE id = ? AND id_hotel = ?",
      [imageId, hotelId],
      (err2, rows) => {
        if (err2) return res.status(500).send("Erreur serveur");
        if (!rows.length) return res.status(404).send("Image introuvable");

        const chemin = rows[0].chemin;

        if (hotel.image_principale && hotel.image_principale !== chemin) {
          // on garde l'ancienne principale dans la galerie si elle existait seulement en colonne
        }

        db.query(
          "UPDATE hotels SET image_principale = ? WHERE id = ?",
          [chemin, hotelId],
          err3 => {
            if (err3) return res.status(500).send("Erreur serveur");
            res.json({ message: "Image principale mise à jour", image_principale: chemin });
          }
        );
      }
    );
  });
});

module.exports = router;
