const db = require("../config/db");

const DELETE_BLOCKED_MSG_HOTEL =
  "Impossible de supprimer : des clients ont encore des réservations actives sur cet hôtel (aujourd'hui ou prochainement) et des réservations en attente.";

const DELETE_BLOCKED_MSG_CHAMBRE =
  "Impossible de supprimer : des clients ont encore des réservations actives ou en attente sur cette chambre (aujourd'hui ou prochainement).";

function normalizeHotelStatut(statut) {
  return String(statut || "").trim().toLowerCase();
}

function isHotelDeletionUnrestricted(statut) {
  const normalized = normalizeHotelStatut(statut);
  return normalized === "en_attente" || normalized === "refuse";
}

function countActiveReservationsSql(scopeColumn) {
  return `
    SELECT COUNT(*) AS total
    FROM reservations r
    ${scopeColumn === "hotel" ? "INNER JOIN chambres c ON c.id = r.id_chambre" : ""}
    WHERE ${scopeColumn === "hotel" ? "c.id_hotel = ?" : "r.id_chambre = ?"}
      AND LOWER(TRIM(r.statut)) NOT IN ('annulee', 'refusee')
      AND r.date_fin IS NOT NULL
      AND DATE(r.date_fin) >= CURDATE()
  `;
}

function assessHotelDeletion(hotelId, statut, callback) {
  if (isHotelDeletionUnrestricted(statut)) {
    return callback(null, {
      peut_supprimer: true,
      message_suppression: null,
      reservations_actives: 0
    });
  }

  const normalized = normalizeHotelStatut(statut);
  if (normalized !== "valide") {
    return callback(null, {
      peut_supprimer: true,
      message_suppression: null,
      reservations_actives: 0
    });
  }

  db.query(countActiveReservationsSql("hotel"), [Number(hotelId)], (err, rows) => {
    if (err) return callback(err);

    const activeCount = Number(rows[0]?.total || 0);
    callback(null, {
      peut_supprimer: activeCount === 0,
      message_suppression: activeCount > 0 ? DELETE_BLOCKED_MSG_HOTEL : null,
      reservations_actives: activeCount
    });
  });
}

function assessChambreDeletion(chambreId, hotelStatut, callback) {
  if (isHotelDeletionUnrestricted(hotelStatut)) {
    return callback(null, {
      peut_supprimer: true,
      message_suppression: null,
      reservations_actives: 0
    });
  }

  const normalized = normalizeHotelStatut(hotelStatut);
  if (normalized !== "valide") {
    return callback(null, {
      peut_supprimer: true,
      message_suppression: null,
      reservations_actives: 0
    });
  }

  db.query(countActiveReservationsSql("chambre"), [Number(chambreId)], (err, rows) => {
    if (err) return callback(err);

    const activeCount = Number(rows[0]?.total || 0);
    callback(null, {
      peut_supprimer: activeCount === 0,
      message_suppression: activeCount > 0 ? DELETE_BLOCKED_MSG_CHAMBRE : null,
      reservations_actives: activeCount
    });
  });
}

function attachChambreDeletionPolicies(chambres, hotelStatut, callback) {
  if (!Array.isArray(chambres) || !chambres.length) {
    return callback(null, []);
  }

  if (isHotelDeletionUnrestricted(hotelStatut) || normalizeHotelStatut(hotelStatut) !== "valide") {
    return callback(
      null,
      chambres.map(c => ({
        ...c,
        peut_supprimer: true,
        message_suppression: null,
        reservations_actives: 0
      }))
    );
  }

  const ids = chambres.map(c => c.id);
  db.query(
    `SELECT r.id_chambre, COUNT(*) AS total
     FROM reservations r
     WHERE r.id_chambre IN (?)
       AND LOWER(TRIM(r.statut)) NOT IN ('annulee', 'refusee')
       AND r.date_fin IS NOT NULL
       AND DATE(r.date_fin) >= CURDATE()
     GROUP BY r.id_chambre`,
    [ids],
    (err, rows) => {
      if (err) return callback(err);

      const activeByChambre = {};
      rows.forEach(row => {
        activeByChambre[row.id_chambre] = Number(row.total || 0);
      });

      callback(
        null,
        chambres.map(c => {
          const activeCount = activeByChambre[c.id] || 0;
          return {
            ...c,
            peut_supprimer: activeCount === 0,
            message_suppression: activeCount > 0 ? DELETE_BLOCKED_MSG_CHAMBRE : null,
            reservations_actives: activeCount
          };
        })
      );
    }
  );
}

function detachChambreFromReservations(chambreId, callback) {
  db.query("UPDATE reservations SET id_chambre = NULL WHERE id_chambre = ?", [Number(chambreId)], callback);
}

module.exports = {
  DELETE_BLOCKED_MSG_HOTEL,
  DELETE_BLOCKED_MSG_CHAMBRE,
  normalizeHotelStatut,
  assessHotelDeletion,
  assessChambreDeletion,
  attachChambreDeletionPolicies,
  detachChambreFromReservations
};
