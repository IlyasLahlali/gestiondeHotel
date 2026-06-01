const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifierToken = require('../middleware/authMiddleware');
const notify = require('../utils/notificationService');

// ➕ RÉSERVER CHAMBRE (client seulement)
router.post('/reservations', verifierToken, (req, res) => {

  const { id_chambre, date_debut, date_fin } = req.body;

  // vérifier champs
  if (!id_chambre || !date_debut || !date_fin) {
    return res.status(400).send("Tous les champs sont obligatoires");
  }

  // 🔥 vérifier que date_debut < date_fin
if (new Date(date_debut) >= new Date(date_fin)) {
  return res.status(400).send("Dates invalides");
}

  // vérifier rôle
  if (req.user.role !== 'client') {
    return res.status(403).send("Accès refusé : client seulement");
  }

  const id_client = req.user.id;

  // 🔥 vérifier disponibilité
  db.query(
    `SELECT * FROM reservations 
     WHERE id_chambre = ?
     AND statut NOT IN ('annulee', 'refusee')
     AND (date_debut <= ? AND date_fin >= ?)`,
    [id_chambre, date_fin, date_debut],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length > 0) {
        return res.status(400).send("Chambre déjà réservée pour ces dates");
      }

      // ➕ ajouter réservation
      db.query(
        "INSERT INTO reservations (id_chambre, id_client, date_debut, date_fin, statut) VALUES (?, ?, ?, ?, 'en_attente')",
        [id_chambre, id_client, date_debut, date_fin],
        (err, result) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Erreur serveur");
          }

          const reservationId = result.insertId;
          notify.fire(() => notify.sendReservationEnAttente(reservationId));
          res.send("Réservation envoyée (en attente)");
        }
      );
    }
  );
});

// ✏️ MODIFIER réservation (client seulement)
router.put('/reservations/:id', verifierToken, (req, res) => {

  const id_reservation = req.params.id;
  const { date_debut, date_fin } = req.body;

  if (req.user.role !== 'client') {
    return res.status(403).send("Accès refusé : client seulement");
  }

  // vérifier propriété + statut
  db.query(
    "SELECT * FROM reservations WHERE id = ? AND id_client = ?",
    [id_reservation, req.user.id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length === 0) {
        return res.status(403).send("Réservation introuvable");
      }

      if (result[0].statut !== 'en_attente') {
        return res.status(400).send("Impossible de modifier une réservation validée");
      }

      // MODIFICATION
      db.query(
        "UPDATE reservations SET date_debut = ?, date_fin = ? WHERE id = ?",
        [date_debut, date_fin, id_reservation],
        (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Erreur serveur");
          }

          res.send("Réservation modifiée");
        }
      );
    }
  );
});

// ❌ ANNULER réservation (client seulement)
router.put('/reservations/:id/annuler', verifierToken, (req, res) => {

  const id_reservation = req.params.id;

  if (req.user.role !== 'client') {
    return res.status(403).send("Accès refusé : client seulement");
  }

  // 🔐 vérifier que la réservation appartient au client
  db.query(
    "SELECT * FROM reservations WHERE id = ? AND id_client = ?",
    [id_reservation, req.user.id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length === 0) {
        return res.status(403).send("Réservation introuvable");
      }

      // ❌ annulation
      db.query(
        "UPDATE reservations SET statut = 'annulee' WHERE id = ?",
        [id_reservation],
        (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Erreur serveur");
          }

          notify.fire(() => notify.sendReservationAnnuleeProprietaire(id_reservation));
          res.send("Réservation annulée");
        }
      );
    }
  );
});

// 📄 Voir réservations des hôtels du propriétaire
router.get('/reservations/proprietaire/detail', verifierToken, (req, res) => {

  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé");
  }

  const query = `
    SELECT 
      r.id,
      r.date_debut,
      r.date_fin,
      r.statut,

      u.nom,
      u.prenom,
      u.email,

      h.nom AS hotel_nom,
      h.ville,
      h.adresse,
      c.type AS chambre_type,
      c.prix AS chambre_prix,
      c.capacite AS chambre_capacite

    FROM reservations r
    JOIN utilisateurs u ON r.id_client = u.id
    JOIN chambres c ON r.id_chambre = c.id
    JOIN hotels h ON c.id_hotel = h.id

    WHERE h.id_proprietaire = ?
    ORDER BY r.date_debut DESC, r.id DESC
  `;

  db.query(query, [req.user.id], (err, result) => {
    if (err) return res.status(500).send("Erreur serveur");
    res.json(result);
  });
});

// ✔️ VALIDER réservation (propriétaire)
router.put('/reservations/:id/valider', verifierToken, (req, res) => {

  // vérifier rôle
  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé : propriétaire seulement");
  }

  const id_reservation = req.params.id;
  const id_proprietaire = req.user.id;

  // 🔐 vérifier si Réservation existe
  db.query(
    `SELECT r.id
     FROM reservations r
     JOIN chambres c ON r.id_chambre = c.id
     JOIN hotels h ON c.id_hotel = h.id
     WHERE r.id = ? AND h.id_proprietaire = ?`,
    [id_reservation, id_proprietaire],
    (err, result) => {

      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length === 0) {
        return res.status(403).send("Réservation introuvable ou non autorisée");
      }

      // ✔ validation
      db.query(
        "UPDATE reservations SET statut = 'confirmee' WHERE id = ?",
        [id_reservation],
        (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Erreur serveur");
          }

          notify.fire(() => notify.sendReservationConfirmee(id_reservation));
          res.send("Réservation validée");
        }
      );
    }
  );
});

// ❌ REFUSER réservation (propriétaire)
router.put('/reservations/:id/refuser', verifierToken, (req, res) => {

  // Vérifier le rôle --> Proprietaire
  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé : propriétaire seulement");
  }

  const id_reservation = req.params.id;
  const id_proprietaire = req.user.id;

  db.query(
    `SELECT r.id
     FROM reservations r
     JOIN chambres c ON r.id_chambre = c.id
     JOIN hotels h ON c.id_hotel = h.id
     WHERE r.id = ? AND h.id_proprietaire = ?`,
    [id_reservation, id_proprietaire],
    (err, result) => {

      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length === 0) {
        return res.status(403).send("Réservation introuvable ou non autorisée");
      }

      db.query(
        "UPDATE reservations SET statut = 'refusee' WHERE id = ?",
        [id_reservation],
        (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Erreur serveur");
          }

          notify.fire(() => notify.sendReservationRefusee(id_reservation));
          res.send("Réservation refusée");
        }
      );
    }
  );
});

// 📄 CLIENT - voir ses réservations
router.get('/reservations/mes-reservations', verifierToken, (req, res) => {

  if (req.user.role !== 'client') {
    return res.status(403).send("Accès refusé : client seulement");
  }

  const id_client = req.user.id;

  const sql = `
    SELECT 
      r.id,
      r.date_debut,
      r.date_fin,
      r.statut,
      c.type AS chambre_type,
      c.prix,
      c.capacite,
      h.nom AS hotel_nom,
      h.ville,
      h.adresse
    FROM reservations r
    JOIN chambres c ON r.id_chambre = c.id
    JOIN hotels h ON c.id_hotel = h.id
    WHERE r.id_client = ?
    ORDER BY r.date_debut DESC
  `;

  db.query(sql, [id_client], (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).send("Erreur serveur");
    }

    res.json(result);
  });
});

module.exports = router;

