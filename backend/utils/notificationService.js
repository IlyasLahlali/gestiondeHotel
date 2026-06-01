const db = require("../config/db");

function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function fire(promiseFn) {
  promiseFn().catch(err => console.error("Notification error:", err.message || err));
}

async function createNotification({
  userId,
  role,
  type,
  titre,
  message,
  lien = null,
  hotelId = null,
  reservationId = null
}) {
  await dbQuery(
    `INSERT INTO notifications
      (id_utilisateur, role, type, titre, message, lien, id_hotel, id_reservation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, role, type, titre, message, lien, hotelId, reservationId]
  );
}

async function notifyAllAdmins(payload) {
  const admins = await dbQuery(
    "SELECT id FROM utilisateurs WHERE role = 'admin'"
  );

  await Promise.all(
    admins.map(admin =>
      createNotification({
        userId: admin.id,
        role: "admin",
        ...payload
      })
    )
  );
}

async function getHotelContext(hotelId) {
  const rows = await dbQuery(
    `SELECT h.id, h.nom, h.id_proprietaire,
            u.nom AS prop_nom, u.prenom AS prop_prenom
     FROM hotels h
     INNER JOIN utilisateurs u ON u.id = h.id_proprietaire
     WHERE h.id = ?
     LIMIT 1`,
    [hotelId]
  );
  return rows[0] || null;
}

async function getReservationContext(reservationId) {
  const rows = await dbQuery(
    `SELECT r.id, r.id_client, r.statut,
            h.id AS hotel_id, h.nom AS hotel_nom, h.id_proprietaire,
            u.nom AS client_nom, u.prenom AS client_prenom
     FROM reservations r
     INNER JOIN chambres c ON c.id = r.id_chambre
     INNER JOIN hotels h ON h.id = c.id_hotel
     INNER JOIN utilisateurs u ON u.id = r.id_client
     WHERE r.id = ?
     LIMIT 1`,
    [reservationId]
  );
  return rows[0] || null;
}

async function sendWelcomeProprietaire(userId) {
  const existing = await dbQuery(
    "SELECT id FROM notifications WHERE id_utilisateur = ? AND type = 'bienvenue_proprietaire' LIMIT 1",
    [userId]
  );
  if (existing.length) return;

  await createNotification({
    userId,
    role: "proprietaire",
    type: "bienvenue_proprietaire",
    titre: "Bienvenue sur HôtelFacile Smart",
    message:
      "Ajoutez votre premier hôtel pour commencer à recevoir des réservations.",
    lien: "hotelAjouter.html"
  });
}

async function sendWelcomeClient(userId) {
  const existing = await dbQuery(
    "SELECT id FROM notifications WHERE id_utilisateur = ? AND type = 'bienvenue_client' LIMIT 1",
    [userId]
  );
  if (existing.length) return;

  await createNotification({
    userId,
    role: "client",
    type: "bienvenue_client",
    titre: "Bienvenue sur HôtelFacile Smart",
    message:
      "Explorez les destinations et réservez votre prochain séjour en quelques clics.",
    lien: "Dashboard.html"
  });
}

async function sendWelcomeAdmin(userId) {
  const existing = await dbQuery(
    "SELECT id FROM notifications WHERE id_utilisateur = ? AND type = 'bienvenue_admin' LIMIT 1",
    [userId]
  );
  if (existing.length) return;

  await createNotification({
    userId,
    role: "admin",
    type: "bienvenue_admin",
    titre: "Bienvenue dans l'espace administrateur",
    message:
      "Consultez les hôtels en attente et gérez la plateforme depuis votre tableau de bord.",
    lien: "Dashboard.html"
  });
}

async function sendHotelEnAttente(hotelId) {
  const hotel = await getHotelContext(hotelId);
  if (!hotel) return;

  const propLabel = `${hotel.prop_prenom || ""} ${hotel.prop_nom || ""}`.trim();

  await createNotification({
    userId: hotel.id_proprietaire,
    role: "proprietaire",
    type: "hotel_en_attente",
    titre: "Hôtel soumis",
    message: `Votre hôtel « ${hotel.nom} » est en attente de validation par l'administration.`,
    lien: `hotelDetail.html?id=${hotelId}`,
    hotelId
  });

  await notifyAllAdmins({
    type: "hotel_en_attente",
    titre: "Nouvel hôtel à valider",
    message: `L'hôtel « ${hotel.nom} »${propLabel ? ` (${propLabel})` : ""} est en attente de validation.`,
    lien: `hotelDetail.html?id=${hotelId}`,
    hotelId
  });
}

async function sendHotelValide(hotelId) {
  const hotel = await getHotelContext(hotelId);
  if (!hotel) return;

  await createNotification({
    userId: hotel.id_proprietaire,
    role: "proprietaire",
    type: "hotel_valide",
    titre: "Hôtel validé",
    message: `Félicitations ! Votre hôtel « ${hotel.nom} » a été validé et est visible sur la plateforme.`,
    lien: `hotelDetail.html?id=${hotelId}`,
    hotelId
  });
}

async function sendHotelRefuse(hotelId) {
  const hotel = await getHotelContext(hotelId);
  if (!hotel) return;

  await createNotification({
    userId: hotel.id_proprietaire,
    role: "proprietaire",
    type: "hotel_refuse",
    titre: "Hôtel refusé",
    message: `Votre hôtel « ${hotel.nom} » n'a pas été validé. Consultez les détails ou contactez le support.`,
    lien: `hotelDetail.html?id=${hotelId}`,
    hotelId
  });
}

async function sendHotelValideAdmin(hotelId, adminId) {
  const hotel = await getHotelContext(hotelId);
  if (!hotel || !adminId) return;

  await createNotification({
    userId: adminId,
    role: "admin",
    type: "hotel_valide_admin",
    titre: "Hôtel validé",
    message: `Vous avez validé l'hôtel « ${hotel.nom} ». Il est maintenant visible sur la plateforme.`,
    lien: `hotelDetail.html?id=${hotelId}`,
    hotelId
  });
}

async function sendHotelRefuseAdmin(hotelId, adminId) {
  const hotel = await getHotelContext(hotelId);
  if (!hotel || !adminId) return;

  await createNotification({
    userId: adminId,
    role: "admin",
    type: "hotel_refuse_admin",
    titre: "Hôtel refusé",
    message: `Vous avez refusé l'hôtel « ${hotel.nom} ». Le propriétaire en a été informé.`,
    lien: `hotelDetail.html?id=${hotelId}`,
    hotelId
  });
}

async function sendProprietaireInscrit(proprietaireId) {
  const rows = await dbQuery(
    "SELECT id, nom, prenom, email FROM utilisateurs WHERE id = ? AND role = 'proprietaire' LIMIT 1",
    [proprietaireId]
  );
  if (!rows.length) return;

  const u = rows[0];
  const label = `${u.prenom || ""} ${u.nom || ""}`.trim() || u.email;

  await notifyAllAdmins({
    type: "proprietaire_inscrit",
    titre: "Nouveau propriétaire inscrit",
    message: `${label} (${u.email}) vient de créer un compte propriétaire.`,
    lien: "Dashboard.html"
  });
}

async function sendReservationEnAttente(reservationId) {
  const ctx = await getReservationContext(reservationId);
  if (!ctx) return;

  const clientLabel = `${ctx.client_prenom || ""} ${ctx.client_nom || ""}`.trim();

  await createNotification({
    userId: ctx.id_client,
    role: "client",
    type: "reservation_en_attente",
    titre: "Réservation envoyée",
    message: `Votre demande pour « ${ctx.hotel_nom} » est en attente de validation.`,
    lien: "reservationDetail.html",
    hotelId: ctx.hotel_id,
    reservationId
  });

  await createNotification({
    userId: ctx.id_proprietaire,
    role: "proprietaire",
    type: "reservation_nouvelle",
    titre: "Nouvelle réservation",
    message: `${clientLabel || "Un client"} a réservé une chambre à « ${ctx.hotel_nom} ».`,
    lien: "reservationDetail.html",
    hotelId: ctx.hotel_id,
    reservationId
  });
}

async function sendReservationConfirmee(reservationId) {
  const ctx = await getReservationContext(reservationId);
  if (!ctx) return;

  await createNotification({
    userId: ctx.id_client,
    role: "client",
    type: "reservation_confirmee",
    titre: "Réservation validée",
    message: `Bonne nouvelle ! Votre réservation à « ${ctx.hotel_nom} » a été confirmée.`,
    lien: "reservationDetail.html",
    hotelId: ctx.hotel_id,
    reservationId
  });
}

async function sendReservationRefusee(reservationId) {
  const ctx = await getReservationContext(reservationId);
  if (!ctx) return;

  await createNotification({
    userId: ctx.id_client,
    role: "client",
    type: "reservation_refusee",
    titre: "Réservation refusée",
    message: `Votre réservation à « ${ctx.hotel_nom} » n'a pas été acceptée par l'établissement.`,
    lien: "reservationDetail.html",
    hotelId: ctx.hotel_id,
    reservationId
  });
}

async function sendReservationAnnuleeProprietaire(reservationId) {
  const ctx = await getReservationContext(reservationId);
  if (!ctx) return;

  const clientLabel = `${ctx.client_prenom || ""} ${ctx.client_nom || ""}`.trim();

  await createNotification({
    userId: ctx.id_proprietaire,
    role: "proprietaire",
    type: "reservation_annulee",
    titre: "Réservation annulée",
    message: `${clientLabel || "Un client"} a annulé sa réservation à « ${ctx.hotel_nom} ».`,
    lien: "reservationDetail.html",
    hotelId: ctx.hotel_id,
    reservationId
  });
}

async function sendAvisNouveau(hotelId, clientId, note) {
  const hotel = await getHotelContext(hotelId);
  if (!hotel) return;

  const rows = await dbQuery(
    "SELECT nom, prenom FROM utilisateurs WHERE id = ? LIMIT 1",
    [clientId]
  );
  const client = rows[0];
  const clientLabel = client
    ? `${client.prenom || ""} ${client.nom || ""}`.trim()
    : "Un client";

  await createNotification({
    userId: hotel.id_proprietaire,
    role: "proprietaire",
    type: "avis_nouveau",
    titre: "Nouvel avis",
    message: `${clientLabel || "Un client"} a laissé un avis (${note}/5) sur « ${hotel.nom} ».`,
    lien: `hotelDetail.html?id=${hotelId}`,
    hotelId
  });
}

module.exports = {
  fire,
  createNotification,
  sendWelcomeProprietaire,
  sendWelcomeClient,
  sendWelcomeAdmin,
  sendHotelEnAttente,
  sendHotelValide,
  sendHotelRefuse,
  sendHotelValideAdmin,
  sendHotelRefuseAdmin,
  sendProprietaireInscrit,
  sendReservationEnAttente,
  sendReservationConfirmee,
  sendReservationRefusee,
  sendReservationAnnuleeProprietaire,
  sendAvisNouveau
};
