const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifierToken = require('../middleware/authMiddleware');
const notify = require('../utils/notificationService');
const { assessHotelDeletion } = require('../utils/deletionPolicy');

function parseOptionalCoord(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function sqlFoldAccents(columnExpr) {
  return `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${columnExpr},'é','e'),'è','e'),'ê','e'),'ë','e'),'à','a'),'â','a'),'ù','u'),'û','u'),'ô','o'),'î','i'),'ï','i'),'ç','c'))`;
}

function normalizeSearchTerms(rawValue) {
  return String(rawValue || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function escapeLikeValue(value) {
  return String(value).replace(/[%_]/g, "");
}

function addTextFilter(conditions, params, columnExpr, rawValue) {
  normalizeSearchTerms(rawValue).forEach(term => {
    conditions.push(`${sqlFoldAccents(columnExpr)} LIKE ?`);
    params.push(`%${escapeLikeValue(term)}%`);
  });
}

function addOwnerFilter(conditions, params, rawValue, field) {
  const columnExpr = field === "prenom" ? "u.prenom" : "u.nom";
  const fullNameExpr = "CONCAT(u.prenom, ' ', u.nom)";
  normalizeSearchTerms(rawValue).forEach(term => {
    const contains = `%${escapeLikeValue(term)}%`;
    conditions.push(`(
      ${sqlFoldAccents(columnExpr)} LIKE ?
      OR ${sqlFoldAccents(fullNameExpr)} LIKE ?
    )`);
    params.push(contains, contains);
  });
}

// ➕ AJOUT HÔTEL (propriétaire seulement)
router.post('/hotels', verifierToken, (req, res) => {
  if (req.user.role !== "proprietaire") {
    return res.status(403).send("Accès réservé aux propriétaires");
  }

  const { nom, ville, adresse, description, chambres, latitude, longitude } = req.body;

  if (!nom || !ville || !adresse) {
    return res.status(400).send("Nom, ville et adresse sont obligatoires");
  }

  const lat = parseOptionalCoord(latitude, -90, 90);
  const lng = parseOptionalCoord(longitude, -180, 180);

  const villesAutorisees = [
  "Marrakech",
  "Rabat",
  "Casablanca",
  "Tanger",
  "Fès",
  "Agadir",
  "Oujda",
  "Meknès"
 ];

 if (!villesAutorisees.includes(ville)) {
  return res.status(400).send("Ville invalide");
 }

  

  const id_proprietaire = req.user.id;
  const descriptionValue = description || null;

  db.query(
    "SELECT * FROM hotels WHERE nom = ? AND ville = ? AND id_proprietaire = ?",
    [nom, ville, id_proprietaire],
    (err, result) => {
      if (err) return res.status(500).send("Erreur serveur");
      if (result.length > 0) return res.status(400).send("L'hôtel existe déjà");

      // Ajouter l'hôtel
      db.query(
        "INSERT INTO hotels (nom, ville, adresse, description, id_proprietaire, statut, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [nom, ville, adresse, descriptionValue, id_proprietaire, 'en_attente', lat, lng],
        (err, result) => {
          if (err) return res.status(500).send("Erreur serveur");

          const hotelId = result.insertId;

          // Ajouter les chambres
          const successPayload = (msg, chambresCreated = []) => {
            notify.fire(() => notify.sendHotelEnAttente(hotelId));
            return res.status(201).json({
              id: hotelId,
              message: msg,
              chambres: chambresCreated
            });
          };

          if (Array.isArray(chambres) && chambres.length > 0) {
            const values = chambres.map(c => [hotelId, c.type, c.prix, c.capacite]);
            
            db.query(
              "INSERT INTO chambres (id_hotel, type, prix, capacite) VALUES ?",
              [values],
              (err) => {
                if (err) return res.status(500).send("Erreur ajout chambres");
                db.query(
                  "SELECT id, type, prix, capacite FROM chambres WHERE id_hotel = ? ORDER BY id ASC",
                  [hotelId],
                  (selectErr, chambreRows) => {
                    if (selectErr) {
                      return successPayload("Hôtel et chambres ajoutés avec succès (en attente de validation)");
                    }
                    return successPayload(
                      "Hôtel et chambres ajoutés avec succès (en attente de validation)",
                      chambreRows || []
                    );
                  }
                );
              }
            );
          } else {
            successPayload("Hôtel ajouté avec succès (en attente de validation) mais aucune chambre ajoutée");
          }
        }
      );
    }
  );
});

// 👑 ADMIN - liste / recherche hôtels
router.get('/hotels/admin/list', verifierToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send("Accès refusé : admin seulement");
  }

  const { statut, nomHotel, prenom, nom, ville } = req.query;
  const hotelName = nomHotel || req.query.hotel;
  const filtresAutorises = ['en_attente', 'valide', 'refuse'];
  const conditions = [];
  const sqlParams = [];

  if (statut && filtresAutorises.includes(statut)) {
    conditions.push('h.statut = ?');
    sqlParams.push(statut);
  }

  if (hotelName && String(hotelName).trim()) {
    addTextFilter(conditions, sqlParams, 'h.nom', hotelName);
  }

  if (prenom && String(prenom).trim()) {
    addOwnerFilter(conditions, sqlParams, prenom, 'prenom');
  }

  if (nom && String(nom).trim()) {
    addOwnerFilter(conditions, sqlParams, nom, 'nom');
  }

  if (ville && String(ville).trim()) {
    addTextFilter(conditions, sqlParams, 'h.ville', ville);
  }

  const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

  const sqlWithAvis = `
    SELECT
      h.*,
      u.nom AS proprietaire_nom,
      u.prenom AS proprietaire_prenom,
      u.email AS proprietaire_email,
      COALESCE(ch.nb_chambres, 0) AS nb_chambres,
      av.note_moyenne,
      COALESCE(av.nb_avis, 0) AS nb_avis
    FROM hotels h
    JOIN utilisateurs u ON h.id_proprietaire = u.id
    LEFT JOIN (
      SELECT id_hotel, COUNT(*) AS nb_chambres
      FROM chambres
      GROUP BY id_hotel
    ) ch ON ch.id_hotel = h.id
    LEFT JOIN (
      SELECT id_hotel,
        ROUND(AVG(note), 1) AS note_moyenne,
        COUNT(*) AS nb_avis
      FROM avis
      GROUP BY id_hotel
    ) av ON av.id_hotel = h.id
    ${whereClause}
    ORDER BY h.id DESC`;

  const sqlBasic = `
    SELECT
      h.*,
      u.nom AS proprietaire_nom,
      u.prenom AS proprietaire_prenom,
      u.email AS proprietaire_email,
      COALESCE(ch.nb_chambres, 0) AS nb_chambres,
      NULL AS note_moyenne,
      0 AS nb_avis
    FROM hotels h
    JOIN utilisateurs u ON h.id_proprietaire = u.id
    LEFT JOIN (
      SELECT id_hotel, COUNT(*) AS nb_chambres
      FROM chambres
      GROUP BY id_hotel
    ) ch ON ch.id_hotel = h.id
    ${whereClause}
    ORDER BY h.id DESC`;

  function mapHotels(rows) {
    return rows.map(h => ({
      ...h,
      nb_chambres: Number(h.nb_chambres) || 0,
      nb_avis: Number(h.nb_avis) || 0,
      note_moyenne: h.note_moyenne != null ? Number(h.note_moyenne) : null
    }));
  }

  function runQuery(sql, withAvis) {
    db.query(sql, sqlParams, (err, result) => {
      if (err) {
        if (withAvis) {
          console.log("admin/list: requête avis indisponible, repli sans avis", err.message);
          return runQuery(sqlBasic, false);
        }
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      res.json(mapHotels(result));
    });
  }

  runQuery(sqlWithAvis, true);
});

// 👑 ADMIN - détail d'un hôtel
router.get('/hotels/admin/:id', verifierToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send("Accès refusé : admin seulement");
  }

  const hotelId = req.params.id;
  if (!/^\d+$/.test(hotelId)) {
    return res.status(400).send("Identifiant d'hôtel invalide");
  }

  const sqlWithAvis = `
    SELECT
      h.*,
      u.nom AS proprietaire_nom,
      u.prenom AS proprietaire_prenom,
      u.email AS proprietaire_email,
      COALESCE(ch.nb_chambres, 0) AS nb_chambres,
      av.note_moyenne,
      COALESCE(av.nb_avis, 0) AS nb_avis
    FROM hotels h
    JOIN utilisateurs u ON h.id_proprietaire = u.id
    LEFT JOIN (
      SELECT id_hotel, COUNT(*) AS nb_chambres
      FROM chambres
      GROUP BY id_hotel
    ) ch ON ch.id_hotel = h.id
    LEFT JOIN (
      SELECT id_hotel,
        ROUND(AVG(note), 1) AS note_moyenne,
        COUNT(*) AS nb_avis
      FROM avis
      GROUP BY id_hotel
    ) av ON av.id_hotel = h.id
    WHERE h.id = ?`;

  const sqlBasic = `
    SELECT
      h.*,
      u.nom AS proprietaire_nom,
      u.prenom AS proprietaire_prenom,
      u.email AS proprietaire_email,
      COALESCE(ch.nb_chambres, 0) AS nb_chambres,
      NULL AS note_moyenne,
      0 AS nb_avis
    FROM hotels h
    JOIN utilisateurs u ON h.id_proprietaire = u.id
    LEFT JOIN (
      SELECT id_hotel, COUNT(*) AS nb_chambres
      FROM chambres
      GROUP BY id_hotel
    ) ch ON ch.id_hotel = h.id
    WHERE h.id = ?`;

  function mapHotel(row) {
    if (!row) return null;
    return {
      ...row,
      nb_chambres: Number(row.nb_chambres) || 0,
      nb_avis: Number(row.nb_avis) || 0,
      note_moyenne: row.note_moyenne != null ? Number(row.note_moyenne) : null
    };
  }

  function runQuery(sql, withAvis) {
    db.query(sql, [hotelId], (err, result) => {
      if (err) {
        if (withAvis) {
          console.log("admin/detail: requête avis indisponible, repli sans avis", err.message);
          return runQuery(sqlBasic, false);
        }
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (!result.length) {
        return res.status(404).send("Hôtel introuvable");
      }

      res.json(mapHotel(result[0]));
    });
  }

  runQuery(sqlWithAvis, true);
});

// 👑 ADMIN - voir hôtels en attente (compatibilité)
router.get('/hotels/pending', verifierToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send("Accès refusé : admin seulement");
  }

  db.query(
    `SELECT
      h.*,
      u.nom AS proprietaire_nom,
      u.prenom AS proprietaire_prenom,
      u.email AS proprietaire_email,
      (SELECT COUNT(*) FROM chambres c WHERE c.id_hotel = h.id) AS nb_chambres
    FROM hotels h
    JOIN utilisateurs u ON h.id_proprietaire = u.id
    WHERE h.statut = 'en_attente'
    ORDER BY h.id DESC`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      res.json(result);
    }
  );
});

// ✔️ ADMIN - valider hôtel
router.put('/hotels/:id/valider', verifierToken, (req, res) => {

  // vérifier rôle admin
  if (req.user.role !== 'admin') {
    return res.status(403).send("Accès refusé : admin seulement");
  }

  const hotelId = req.params.id;

  db.query(
    "UPDATE hotels SET statut = 'valide' WHERE id = ?",
    [hotelId],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      notify.fire(async () => {
        await notify.sendHotelValide(hotelId);
        await notify.sendHotelValideAdmin(hotelId, req.user.id);
      });
      res.send("Hôtel validé avec succès");
    }
  );
});

// ❌ ADMIN - refuser hôtel
router.put('/hotels/:id/refuser', verifierToken, (req, res) => {

  // vérifier rôle admin
  if (req.user.role !== 'admin') {
    return res.status(403).send("Accès refusé : admin seulement");
  }

  const hotelId = req.params.id;

  db.query(
    "UPDATE hotels SET statut = 'refuse' WHERE id = ?",
    [hotelId],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      notify.fire(async () => {
        await notify.sendHotelRefuse(hotelId);
        await notify.sendHotelRefuseAdmin(hotelId, req.user.id);
      });
      res.send("Hôtel refusé");
    }
  );
});

// 🌍 hôtels validés (PUBLIC - tout le monde peut voir)
router.get('/hotels/validated', (req, res) => {

  db.query(
    "SELECT * FROM hotels WHERE statut = 'valide'",
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      res.json(result);
    }
  );
});

// ✏️ MODIFIER HÔTEL (propriétaire seulement)
router.put('/hotels/:id', verifierToken, (req, res) => {

  const hotelId = req.params.id;
  let { nom, ville, adresse, description, latitude, longitude } = req.body;
  const lat = parseOptionalCoord(latitude, -90, 90);
  const lng = parseOptionalCoord(longitude, -180, 180);

  // vérifier rôle
  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé : propriétaire seulement");
  }

  // ✅ sécuriser ville
  if (!ville) {
    return res.status(400).send("Ville obligatoire");
  }

  ville = ville.trim();

  const villesAutorisees = [
    "Marrakech",
    "Rabat",
    "Casablanca",
    "Tanger",
    "Fès",
    "Agadir",
    "Oujda",
    "Meknès"
  ];

  if (!villesAutorisees.includes(ville)) {
    return res.status(400).send("Ville invalide");
  }

  const id_proprietaire = req.user.id;

  // vérifier propriété
  db.query(
    "SELECT * FROM hotels WHERE id = ? AND id_proprietaire = ?",
    [hotelId, id_proprietaire],
    (err, result) => {

      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length === 0) {
        return res.status(403).send("Hôtel introuvable ou non autorisé");
      }

      // update
      db.query(
        "UPDATE hotels SET nom=?, ville=?, adresse=?, description=?, latitude=?, longitude=? WHERE id=?",
        [nom, ville, adresse, description || null, lat, lng, hotelId],
        (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Erreur serveur");
          }

          res.send("Hôtel modifié avec succès");
        }
      );
    }
  );
});

// ❌ SUPPRIMER HÔTEL (propriétaire seulement)
router.delete('/hotels/:id', verifierToken, (req, res) => {

  const hotelId = req.params.id;

  // vérifier rôle
  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé : propriétaire seulement");
  }

  const id_proprietaire = req.user.id;

  // 🔐 vérifier propriété 
  db.query(
    "SELECT * FROM hotels WHERE id = ? AND id_proprietaire = ?",
    [hotelId, id_proprietaire],
    (err, result) => {

      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      if (result.length === 0) {
        return res.status(403).send("Hôtel introuvable, non autorisé ou non validé");
      }

      const hotel = result[0];

      assessHotelDeletion(Number(hotelId), hotel.statut, (assessErr, policy) => {
        if (assessErr) {
          console.log(assessErr);
          return res.status(500).send("Erreur serveur");
        }

        if (!policy.peut_supprimer) {
          return res.status(409).json({
            message: policy.message_suppression
          });
        }

        db.query(
          "DELETE FROM hotels WHERE id = ?",
          [hotelId],
          (deleteErr) => {
            if (deleteErr) {
              console.log(deleteErr);
              return res.status(500).send("Erreur serveur");
            }

            res.send("Hôtel supprimé avec succès");
          }
        );
      });
    }
  );
});

// 📌 Mes hôtels (Propriétaire voit ses hôtels)
router.get('/hotels/mes-hotels', verifierToken, (req, res) => {

  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé");
  }

  const proprietaireId = req.user.id;

  const sqlWithAvis = `
    SELECT h.*,
       COALESCE(ch.nb_chambres, 0) AS nb_chambres,
       av.note_moyenne,
       COALESCE(av.nb_avis, 0) AS nb_avis
     FROM hotels h
     LEFT JOIN (
       SELECT id_hotel, COUNT(*) AS nb_chambres
       FROM chambres
       GROUP BY id_hotel
     ) ch ON ch.id_hotel = h.id
     LEFT JOIN (
       SELECT id_hotel,
         ROUND(AVG(note), 1) AS note_moyenne,
         COUNT(*) AS nb_avis
       FROM avis
       GROUP BY id_hotel
     ) av ON av.id_hotel = h.id
     WHERE h.id_proprietaire = ?`;

  const sqlBasic = `
    SELECT h.*,
       COALESCE(ch.nb_chambres, 0) AS nb_chambres,
       NULL AS note_moyenne,
       0 AS nb_avis
     FROM hotels h
     LEFT JOIN (
       SELECT id_hotel, COUNT(*) AS nb_chambres
       FROM chambres
       GROUP BY id_hotel
     ) ch ON ch.id_hotel = h.id
     WHERE h.id_proprietaire = ?`;

  function mapHotels(rows) {
    return rows.map(h => ({
      ...h,
      nb_chambres: Number(h.nb_chambres) || 0,
      nb_avis: Number(h.nb_avis) || 0,
      note_moyenne: h.note_moyenne != null ? Number(h.note_moyenne) : null
    }));
  }

  function runQuery(sql, withAvis) {
    db.query(sql, [proprietaireId], (err, result) => {
      if (err) {
        if (withAvis) {
          console.log("mes-hotels: requête avis indisponible, repli sans avis", err.message);
          return runQuery(sqlBasic, false);
        }
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }

      res.json(mapHotels(result));
    });
  }

  runQuery(sqlWithAvis, true);
});

// 📌 Détail d'un hôtel (propriétaire)
router.get('/hotels/mes-hotels/:id', verifierToken, (req, res) => {
  if (req.user.role !== 'proprietaire') {
    return res.status(403).send("Accès refusé");
  }

  const hotelId = req.params.id;

  db.query(
    `SELECT h.*, COUNT(c.id) AS nb_chambres
     FROM hotels h
     LEFT JOIN chambres c ON c.id_hotel = h.id
     WHERE h.id = ? AND h.id_proprietaire = ?
     GROUP BY h.id`,
    [hotelId, req.user.id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Erreur serveur");
      }
      if (!result.length) {
        return res.status(404).send("Hôtel introuvable");
      }

      const hotel = result[0];

      assessHotelDeletion(Number(hotelId), hotel.statut, (assessErr, policy) => {
        if (assessErr) {
          console.log(assessErr);
          return res.status(500).send("Erreur serveur");
        }

        res.json({
          ...hotel,
          peut_supprimer: policy.peut_supprimer,
          message_suppression: policy.message_suppression,
          reservations_actives: policy.reservations_actives
        });
      });
    }
  );
});

// Rechercher Hôtel 
// 🔍 SEARCH HOTELS
// 🔍 SEARCH HOTELS + CHAMBRES
router.get('/hotels/search', (req, res) => {

  const { ville, type, personnes, budget } = req.query;

  if (!ville) {
    return res.status(400).send("Ville obligatoire");
  }

  let sql = `
    SELECT 
      h.id AS hotel_id,
      h.nom,
      h.ville,
      h.adresse,
      h.description,
      h.latitude,
      h.longitude,
      h.image_principale,
      c.id AS chambre_id,
      c.type,
      c.prix,
      c.capacite
    FROM hotels h
    JOIN chambres c ON h.id = c.id_hotel
    WHERE h.ville = ?
    AND h.statut = 'valide'
  `;

  const params = [ville];

  // =====================
  // filtre type chambre
  // =====================
  if (type && type !== "tous") {
    sql += " AND c.type = ?";
    params.push(type);
  }

  // =====================
  // filtre personnes (capacité)
  // =====================
  if (personnes) {
    sql += " AND c.capacite >= ?";
    params.push(personnes);
  }

  // =====================
  // filtre budget max
  // =====================
  if (budget) {
    sql += " AND c.prix <= ?";
    params.push(budget);
  }

  sql += " ORDER BY h.id";

  db.query(sql, params, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Erreur serveur");
    }

    res.json(result);
  });
});

// ⭐ HOTELS POPULAIRES (par nombre de réservations)
router.get('/hotels/popular', (req, res) => {

  db.query(`
    SELECT 
      h.id,
      h.nom,
      h.ville,
      h.adresse,
      h.latitude,
      h.longitude,
      h.image_principale,
      COUNT(r.id) AS total_reservations
    FROM hotels h
    LEFT JOIN chambres c ON h.id = c.id_hotel
    LEFT JOIN reservations r ON c.id = r.id_chambre
    WHERE h.statut = 'valide'
    GROUP BY h.id
    ORDER BY total_reservations DESC
    LIMIT 6
  `, (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).send("Erreur serveur");
    }

    res.json(result);
  });

});

// ⭐ Afficher Villes (par nombre de réservations)
router.get('/villes/popular', (req, res) => {

  const sql = `
    SELECT h.ville, COUNT(r.id) as total_reservations
    FROM reservations r
    JOIN chambres c ON r.id_chambre = c.id
    JOIN hotels h ON c.id_hotel = h.id
    WHERE r.statut NOT IN ('annulee', 'refusee')
    GROUP BY h.ville
    ORDER BY total_reservations DESC
    LIMIT 6
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Erreur serveur");
    }

    res.json(result);
  });

});

// 🔍 RECHERCHE HÔTELS + CHAMBRES (PROPRIÉTAIRE)
router.get("/hotels/searchProprietaire", verifierToken, (req, res) => {

  const id = req.user.id;
  const { nom, type, capacite } = req.query;

  let sql = `
    SELECT 
      h.id AS hotel_id,
      h.nom,
      h.ville,
      h.adresse,
      h.description,
      h.statut,
      h.image_principale,
      h.latitude,
      h.longitude,
      c.id AS id_chambre,
      c.type,
      c.prix,
      c.capacite
    FROM hotels h
    LEFT JOIN chambres c ON h.id = c.id_hotel
    WHERE h.id_proprietaire = ?
  `;

  const params = [id];

  if (nom && String(nom).trim() !== "") {
    sql += " AND h.nom LIKE ?";
    params.push(`%${String(nom).trim()}%`);
  }

  if (type) {
    sql += " AND c.type = ?";  //Afficher l'hôtel avec chambre de type
    params.push(type);
  }

  if (capacite) {
    sql += " AND c.capacite = ?"; //Afficher l'hôtel avec chambre par capacité
    params.push(Number(capacite));
  }

  sql += " ORDER BY h.id DESC";

  db.query(sql, params, (err, result) => {
    if (err) {
      console.log("SQL ERROR:", err);
      return res.status(500).send("Erreur serveur SQL");
    }

    res.json(result);
  });
});

module.exports = router;

