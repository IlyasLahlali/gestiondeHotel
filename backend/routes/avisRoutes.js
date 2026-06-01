const express = require("express");
const router = express.Router();
const db = require("../config/db");
const verifierToken = require("../middleware/authMiddleware");
const notify = require("../utils/notificationService");

function requireClient(req, res) {
  if (req.user.role !== "client") {
    res.status(403).json({ message: "Accès refusé : client seulement" });
    return false;
  }
  return true;
}

function parseNote(value) {
  const note = Number(value);
  if (!Number.isInteger(note) || note < 1 || note > 5) {
    return null;
  }
  return note;
}

function formatAvisRow(row) {
  return {
    id: row.id,
    note: row.note,
    commentaire: row.commentaire,
    created_at: row.created_at,
    updated_at: row.updated_at,
    client: {
      prenom: row.prenom,
      nom: row.nom
    }
  };
}

router.get("/hotels/:hotelId/avis", (req, res) => {
  const hotelId = Number(req.params.hotelId);
  if (!hotelId) {
    return res.status(400).json({ message: "Hôtel invalide" });
  }

  db.query(
    "SELECT id FROM hotels WHERE id = ? AND statut = 'valide' LIMIT 1",
    [hotelId],
    (hotelErr, hotels) => {
      if (hotelErr) {
        console.error(hotelErr);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      if (!hotels.length) {
        return res.status(404).json({ message: "Hôtel introuvable" });
      }

      const sql = `
        SELECT
          a.id,
          a.note,
          a.commentaire,
          a.created_at,
          a.updated_at,
          u.prenom,
          u.nom
        FROM avis a
        INNER JOIN utilisateurs u ON u.id = a.id_client
        WHERE a.id_hotel = ?
        ORDER BY a.created_at DESC
      `;

      db.query(sql, [hotelId], (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Erreur serveur" });
        }

        const total = rows.length;
        const moyenne =
          total > 0
            ? Math.round((rows.reduce((sum, r) => sum + r.note, 0) / total) * 10) / 10
            : null;

        res.json({
          stats: { moyenne, total },
          avis: rows.map(formatAvisRow)
        });
      });
    }
  );
});

router.get("/avis/hotel/:hotelId/mine", verifierToken, (req, res) => {
  if (!requireClient(req, res)) return;

  const hotelId = Number(req.params.hotelId);
  if (!hotelId) {
    return res.status(400).json({ message: "Hôtel invalide" });
  }

  db.query(
    `SELECT id, note, commentaire, created_at, updated_at
     FROM avis
     WHERE id_client = ? AND id_hotel = ?
     LIMIT 1`,
    [req.user.id, hotelId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      res.json(rows[0] || null);
    }
  );
});

router.post("/avis", verifierToken, (req, res) => {
  if (!requireClient(req, res)) return;

  const hotelId = Number(req.body.id_hotel);
  const note = parseNote(req.body.note);
  const commentaire = String(req.body.commentaire || "").trim();

  if (!hotelId) {
    return res.status(400).json({ message: "Hôtel invalide" });
  }

  if (!note) {
    return res.status(400).json({ message: "La note doit être entre 1 et 5 étoiles" });
  }

  if (commentaire.length < 5) {
    return res.status(400).json({ message: "Le commentaire doit contenir au moins 5 caractères" });
  }

  if (commentaire.length > 2000) {
    return res.status(400).json({ message: "Le commentaire est trop long (2000 caractères max)" });
  }

  db.query(
    "SELECT id FROM hotels WHERE id = ? AND statut = 'valide' LIMIT 1",
    [hotelId],
    (hotelErr, hotels) => {
      if (hotelErr) {
        console.error(hotelErr);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      if (!hotels.length) {
        return res.status(404).json({ message: "Hôtel introuvable" });
      }

      db.query(
        `INSERT INTO avis (id_client, id_hotel, note, commentaire)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           note = VALUES(note),
           commentaire = VALUES(commentaire),
           updated_at = CURRENT_TIMESTAMP`,
        [req.user.id, hotelId, note, commentaire],
        (upsertErr, result) => {
          if (upsertErr) {
            console.error(upsertErr);
            return res.status(500).json({ message: "Erreur serveur" });
          }

          const isNewAvis = result?.affectedRows === 1;
          if (isNewAvis) {
            notify.fire(() => notify.sendAvisNouveau(hotelId, req.user.id, note));
          }

          db.query(
            `SELECT id, note, commentaire, created_at, updated_at
             FROM avis
             WHERE id_client = ? AND id_hotel = ?
             LIMIT 1`,
            [req.user.id, hotelId],
            (selectErr, rows) => {
              if (selectErr) {
                console.error(selectErr);
                return res.status(500).json({ message: "Erreur serveur" });
              }

              res.status(201).json({
                message: "Avis enregistré",
                avis: rows[0]
              });
            }
          );
        }
      );
    }
  );
});

router.delete("/avis/:id", verifierToken, (req, res) => {
  if (!requireClient(req, res)) return;

  const avisId = Number(req.params.id);
  if (!avisId) {
    return res.status(400).json({ message: "Avis invalide" });
  }

  db.query(
    "DELETE FROM avis WHERE id = ? AND id_client = ?",
    [avisId, req.user.id],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Avis introuvable" });
      }

      res.json({ message: "Avis supprimé" });
    }
  );
});

router.get("/hotels/mes-hotels/:hotelId/avis", verifierToken, (req, res) => {
  if (req.user.role !== "proprietaire") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const hotelId = Number(req.params.hotelId);
  if (!hotelId) {
    return res.status(400).json({ message: "Hôtel invalide" });
  }

  db.query(
    "SELECT id FROM hotels WHERE id = ? AND id_proprietaire = ? LIMIT 1",
    [hotelId, req.user.id],
    (hotelErr, hotels) => {
      if (hotelErr) {
        console.error(hotelErr);
        return res.status(500).json({ message: "Erreur serveur" });
      }
      if (!hotels.length) {
        return res.status(404).json({ message: "Hôtel introuvable" });
      }

      const sql = `
        SELECT a.id, a.note, a.commentaire, a.created_at, a.updated_at, u.prenom, u.nom
        FROM avis a
        INNER JOIN utilisateurs u ON u.id = a.id_client
        WHERE a.id_hotel = ?
        ORDER BY a.created_at DESC
      `;

      db.query(sql, [hotelId], (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Erreur serveur" });
        }

        const total = rows.length;
        const moyenne =
          total > 0
            ? Math.round((rows.reduce((sum, r) => sum + r.note, 0) / total) * 10) / 10
            : null;

        res.json({
          stats: { moyenne, total },
          avis: rows.map(formatAvisRow)
        });
      });
    }
  );
});

module.exports = router;
