const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const verifierToken = require('../middleware/authMiddleware');
const { JWT_SECRET } = require('../config/env');
const {
  assessChambreDeletion,
  attachChambreDeletionPolicies,
  detachChambreFromReservations
} = require('../utils/deletionPolicy');

function getOptionalUserFromRequest(req) {
  const header = req.headers.authorization;
  if (!header) return null;

  try {
    const token = header.split(' ')[1];
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function fetchChambresWithImages(id_hotel, callback) {
  db.query('SELECT * FROM chambres WHERE id_hotel = ?', [id_hotel], (err, chambres) => {
    if (err) return callback(err);

    if (!chambres.length) {
      return callback(null, []);
    }

    const ids = chambres.map(c => c.id);

    db.query(
      `SELECT id, id_chambre, chemin, ordre
       FROM chambre_images
       WHERE id_chambre IN (?)
       ORDER BY ordre ASC, id ASC`,
      [ids],
      (err2, images) => {
        if (err2) return callback(err2);

        const imagesByChambre = {};
        images.forEach(img => {
          if (!imagesByChambre[img.id_chambre]) {
            imagesByChambre[img.id_chambre] = [];
          }
          imagesByChambre[img.id_chambre].push({
            id: img.id,
            chemin: img.chemin,
            ordre: img.ordre
          });
        });

        callback(
          null,
          chambres.map(c => ({
            ...c,
            images: imagesByChambre[c.id] || []
          }))
        );
      }
    );
  });
}

// ➕ Proprietaire seulement peut Ajouter Chambre
router.post('/chambres', verifierToken, (req, res) => {
  const { id_hotel, type, prix, capacite } = req.body;

  if (!id_hotel || !type || !prix || !capacite) {
    return res.status(400).send("Tous les champs sont obligatoires");
  }

  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé : propriétaire seulement");
  }

  const proprietaire_id = req.user.id;

  db.query(
    "SELECT * FROM hotels WHERE id = ? AND id_proprietaire = ?",
    [id_hotel, proprietaire_id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length === 0) {
        return res.status(403).send("Cet hôtel ne vous appartient pas");
      }

      db.query(
        "INSERT INTO chambres (id_hotel, type, prix, capacite) VALUES (?, ?, ?, ?)",
        [id_hotel, type, prix, capacite],
        (err, result) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Erreur serveur");
          }

          res.json({ message: "Chambre ajoutée avec succès", id: result.insertId });
        }
      );
    }
  );
});

// 📄 Chambres d'un hôtel pour le propriétaire (politique de suppression incluse)
router.get('/chambres/mes-chambres/:id_hotel', verifierToken, (req, res) => {
  const id_hotel = req.params.id_hotel;

  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé : propriétaire seulement");
  }

  db.query(
    "SELECT id, statut FROM hotels WHERE id = ? AND id_proprietaire = ?",
    [id_hotel, req.user.id],
    (err, hotels) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (!hotels.length) {
        return res.status(403).send("Cet hôtel ne vous appartient pas");
      }

      const hotelStatut = hotels[0].statut;

      fetchChambresWithImages(id_hotel, (fetchErr, chambres) => {
        if (fetchErr) {
          console.log(fetchErr);
          return res.status(500).send("Erreur serveur");
        }

        attachChambreDeletionPolicies(chambres, hotelStatut, (policyErr, enriched) => {
          if (policyErr) {
            console.log(policyErr);
            return res.status(500).send("Erreur serveur");
          }

          res.json(enriched);
        });
      });
    }
  );
});

// 📄 Voir les chambres d’un hôtel (avec images ; politique suppression si propriétaire connecté)
router.get('/chambres/:id_hotel', (req, res) => {
  const id_hotel = req.params.id_hotel;

  fetchChambresWithImages(id_hotel, (err, chambres) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Erreur serveur");
    }

    const user = getOptionalUserFromRequest(req);
    if (!user || user.role !== 'proprietaire') {
      return res.json(chambres);
    }

    db.query(
      'SELECT id, statut FROM hotels WHERE id = ? AND id_proprietaire = ?',
      [id_hotel, user.id],
      (hotelErr, hotels) => {
        if (hotelErr) {
          console.log(hotelErr);
          return res.status(500).send("Erreur serveur");
        }

        if (!hotels.length) {
          return res.json(chambres);
        }

        attachChambreDeletionPolicies(chambres, hotels[0].statut, (policyErr, enriched) => {
          if (policyErr) {
            console.log(policyErr);
            return res.status(500).send("Erreur serveur");
          }

          res.json(enriched);
        });
      }
    );
  });
});

// ✏️ Modifier chambre (propriétaire seulement)
router.put('/chambres/:id', verifierToken, (req, res) => {
  const chambreId = req.params.id;
  const { type, prix, capacite } = req.body;

  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé");
  }

  db.query(
    `SELECT c.* FROM chambres c
     JOIN hotels h ON c.id_hotel = h.id
     WHERE c.id = ? AND h.id_proprietaire = ?`,
    [chambreId, req.user.id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length === 0) {
        return res.status(403).send("Cette chambre ne vous appartient pas");
      }

      db.query(
        "UPDATE chambres SET type = ?, prix = ?, capacite = ? WHERE id = ?",
        [type, prix, capacite, chambreId],
        (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Erreur serveur");
          }

          res.send("Chambre modifiée avec succès");
        }
      );
    }
  );
});

// ❌ Supprimer chambre (propriétaire seulement)
router.delete('/chambres/:id', verifierToken, (req, res) => {
  const chambreId = req.params.id;

  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé");
  }

  db.query(
    `SELECT c.*, h.statut AS hotel_statut
     FROM chambres c
     JOIN hotels h ON c.id_hotel = h.id
     WHERE c.id = ? AND h.id_proprietaire = ?`,
    [chambreId, req.user.id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length === 0) {
        return res.status(403).send("Cette chambre ne vous appartient pas");
      }

      const chambre = result[0];

      assessChambreDeletion(Number(chambreId), chambre.hotel_statut, (assessErr, policy) => {
        if (assessErr) {
          console.log(assessErr);
          return res.status(500).send("Erreur serveur");
        }

        if (!policy.peut_supprimer) {
          return res.status(409).json({
            message: policy.message_suppression
          });
        }

        detachChambreFromReservations(Number(chambreId), detachErr => {
          if (detachErr) {
            console.log(detachErr);
            return res.status(500).json({
              message:
                "Impossible de détacher l'historique des réservations. Exécutez migration_chambre_reservations_history.sql."
            });
          }

          db.query('DELETE FROM chambres WHERE id = ?', [chambreId], deleteErr => {
            if (deleteErr) {
              console.log(deleteErr);
              return res.status(500).send("Erreur serveur");
            }

            res.send("Chambre supprimée avec succès");
          });
        });
      });
    }
  );
});

module.exports = router;
