const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifierToken = require('../middleware/authMiddleware');


// ==================================================
// 📊 DASHBOARD PROPRIÉTAIRE - OVERVIEW GLOBAL
// ==================================================
router.get('/proprietaire/stats', verifierToken, (req, res) => {

  const id = req.user.id;

  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM hotels WHERE id_proprietaire = ?) AS totalHotels,

      (SELECT COUNT(r.id)
       FROM reservations r
       JOIN chambres c ON r.id_chambre = c.id
       JOIN hotels h ON c.id_hotel = h.id
       WHERE h.id_proprietaire = ?) AS totalReservations,

      (SELECT COUNT(c.id)
       FROM chambres c
       JOIN hotels h ON c.id_hotel = h.id
       WHERE h.id_proprietaire = ?) AS totalChambres,

      (SELECT IFNULL(SUM(c.prix), 0)
       FROM reservations r
       JOIN chambres c ON r.id_chambre = c.id
       JOIN hotels h ON c.id_hotel = h.id
       WHERE h.id_proprietaire = ?
       AND r.statut = 'confirmee') AS totalRevenus
  `;

  db.query(sql, [id, id, id, id], (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).send("Erreur stats overview");
    }

    res.json(result[0]);
  });
});


// ==================================================
// ⭐ HOTELS LES PLUS POPULAIRES
// ==================================================
router.get('/proprietaire/hotels/popular', verifierToken, (req, res) => {

  const id = req.user.id;

  const sql = `
    SELECT
      h.id,
      h.nom,
      h.ville,
      h.image_principale,
      (
        SELECT COUNT(r.id)
        FROM chambres c
        INNER JOIN reservations r ON r.id_chambre = c.id
        WHERE c.id_hotel = h.id
      ) AS total_reservations
    FROM hotels h
    WHERE h.id_proprietaire = ?
    ORDER BY total_reservations DESC, h.nom ASC
    LIMIT 5
  `;

  db.query(sql, [id], (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).send("Erreur hotels populaires");
    }

    res.json(result);
  });
});


// ==================================================
// 🛏 CHAMBRES PAR TYPE + CAPACITÉ
// ==================================================
router.get('/proprietaire/chambres/stats', verifierToken, async (req, res) => {

  const id = req.user.id;

  const sqlType = `
    SELECT type, COUNT(*) AS total
    FROM chambres c
    JOIN hotels h ON c.id_hotel = h.id
    WHERE h.id_proprietaire = ?
    GROUP BY type
  `;

  const sqlCap = `
    SELECT capacite, COUNT(*) AS total
    FROM chambres c
    JOIN hotels h ON c.id_hotel = h.id
    WHERE h.id_proprietaire = ?
    GROUP BY capacite
    ORDER BY capacite ASC
  `;

  try {

    const typeResult = await new Promise((resolve, reject) => {
      db.query(sqlType, [id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    const capResult = await new Promise((resolve, reject) => {
      db.query(sqlCap, [id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    // ================= TYPES FIXES =================
    const allTypes = ["economique", "standard", "superieur", "deluxe", "suite", "familiale"];

    const byType = allTypes.map(t => {
      const found = typeResult.find(x => x.type === t);
      return {
        type: t,
        total: found ? found.total : 0
      };
    });

    // ================= CAPACITÉS =================
    const byCapacite = [
      { capacite: "1 Personne", total: 0 },
      { capacite: "2 Personnes", total: 0 },
      { capacite: "3 Personnes", total: 0 },
      { capacite: "+4 Personnes", total: 0 }
    ];

    capResult.forEach(c => {
      const cap = Number(c.capacite);
      const total = Number(c.total);

      if (cap === 1) byCapacite[0].total += total;
      else if (cap === 2) byCapacite[1].total += total;
      else if (cap === 3) byCapacite[2].total += total;
      else if (cap >= 4) byCapacite[3].total += total;
    });

    res.json({ byType, byCapacite });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur stats chambres");
  }
});


// ==================================================
// 📊 STATISTIQUES RÉSERVATIONS
// ==================================================
router.get('/proprietaire/reservations/stats', verifierToken, (req, res) => {

  const id = req.user.id;

  const sql = `
    SELECT 
      SUM(CASE WHEN r.statut = 'confirmee' THEN 1 ELSE 0 END) AS confirmee,
      SUM(CASE WHEN r.statut = 'en_attente' THEN 1 ELSE 0 END) AS en_attente,
      SUM(CASE WHEN r.statut = 'annulee' THEN 1 ELSE 0 END) AS annulee
    FROM reservations r
    JOIN chambres c ON r.id_chambre = c.id
    JOIN hotels h ON c.id_hotel = h.id
    WHERE h.id_proprietaire = ?
  `;

  db.query(sql, [id], (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).send("Erreur stats reservations");
    }

    res.json(result[0]);
  });
});

// ==================================================
// 📊 DASHBOARD ADMIN - STATISTIQUES GLOBALES
// ==================================================
router.get('/admin/stats', verifierToken, (req, res) => {

  if (req.user.role !== 'admin') {
    return res.status(403).send("Accès refusé : admin seulement");
  }

  const sql = `
    SELECT
      (SELECT COUNT(*) FROM utilisateurs WHERE role = 'client') AS totalClients,
      (SELECT COUNT(*) FROM utilisateurs WHERE role = 'proprietaire') AS totalProprietaires,
      (SELECT COUNT(*) FROM hotels) AS totalHotels,
      (SELECT COUNT(*) FROM reservations WHERE statut = 'confirmee') AS reservationsConfirmees,
      (SELECT COUNT(*) FROM hotels WHERE statut = 'valide') AS hotelsValides,
      (SELECT COUNT(*) FROM hotels WHERE statut = 'en_attente') AS hotelsEnAttente,
      (SELECT COUNT(*) FROM hotels WHERE statut = 'refuse') AS hotelsRefuses
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Erreur stats admin");
    }

    const stats = {
      totalClients: Number(result[0].totalClients ?? 0),
      totalProprietaires: Number(result[0].totalProprietaires ?? 0),
      totalHotels: Number(result[0].totalHotels ?? 0),
      reservationsConfirmees: Number(result[0].reservationsConfirmees ?? 0),
      hotelsValides: Number(result[0].hotelsValides ?? 0),
      hotelsEnAttente: Number(result[0].hotelsEnAttente ?? 0),
      hotelsRefuses: Number(result[0].hotelsRefuses ?? 0)
    };

    const recentSql = `
      SELECT
        h.id,
        h.nom,
        h.ville,
        h.statut,
        h.image_principale,
        u.prenom AS proprietaire_prenom,
        u.nom AS proprietaire_nom
      FROM hotels h
      JOIN utilisateurs u ON h.id_proprietaire = u.id
      ORDER BY h.id DESC
      LIMIT 5
    `;

    db.query(recentSql, (recentErr, recentRows) => {
      if (recentErr) {
        console.log(recentErr);
        return res.json({ ...stats, recentHotels: [] });
      }

      res.json({
        ...stats,
        recentHotels: (recentRows || []).map(h => ({
          id: h.id,
          nom: h.nom,
          ville: h.ville,
          statut: h.statut,
          image_principale: h.image_principale,
          proprietaire_prenom: h.proprietaire_prenom,
          proprietaire_nom: h.proprietaire_nom,
          proprietaire: [h.proprietaire_prenom, h.proprietaire_nom].filter(Boolean).join(" ")
        }))
      });
    });
  });
});

module.exports = router;