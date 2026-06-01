const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verifierToken = require("../middleware/authMiddleware");
const { JWT_SECRET, GOOGLE_CLIENT_ID } = require("../config/env");
const notify = require("../utils/notificationService");

const ROLES = {
  client: "client",
  proprietaire: "proprietaire",
  admin: "admin"
};

async function verifyGoogleIdToken(idToken) {
  const url =
    "https://oauth2.googleapis.com/tokeninfo?id_token=" +
    encodeURIComponent(idToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Token Google invalide");
  const payload = await res.json();
  if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error("Client ID Google incorrect");
  }
  return payload;
}

function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function buildAuthResponse(user) {
  const token = jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  return {
    message: "Connexion réussie",
    token,
    user: {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role
    }
  };
}

function wrongRoleMessage(expectedRole, actualRole) {
  const labels = {
    client: "client",
    proprietaire: "propriétaire",
    admin: "administrateur"
  };

  return `Ce compte est ${labels[actualRole] || actualRole}. Utilisez la connexion ${labels[expectedRole] || expectedRole}.`;
}

function handleRegister(role) {
  return (req, res) => {
    if (role === ROLES.admin) {
      return res.status(403).json({
        message: "L'inscription administrateur n'est pas autorisée."
      });
    }

    const { nom, prenom, email, mot_de_passe } = req.body;

    if (!nom || !prenom || !email || !mot_de_passe) {
      return res.status(400).json({ message: "Tous les champs sont obligatoires." });
    }

    if (mot_de_passe.length < 6) {
      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    db.query(
      "SELECT id FROM utilisateurs WHERE email = ?",
      [email.trim().toLowerCase()],
      (err, result) => {
        if (err) return res.status(500).json({ message: "Erreur serveur" });
        if (result.length > 0) {
          return res.status(400).json({ message: "Email déjà utilisé" });
        }

        bcrypt.hash(mot_de_passe, 10, (errHash, hash) => {
          if (errHash) return res.status(500).json({ message: "Erreur hash" });

          db.query(
            `INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role)
             VALUES (?, ?, ?, ?, ?)`,
            [nom.trim(), prenom.trim(), email.trim().toLowerCase(), hash, role],
            (err2, insertResult) => {
              if (err2) {
                console.error(err2);
                return res.status(500).json({ message: "Erreur insertion" });
              }
              if (role === ROLES.proprietaire && insertResult?.insertId) {
                notify.fire(async () => {
                  await notify.sendWelcomeProprietaire(insertResult.insertId);
                  await notify.sendProprietaireInscrit(insertResult.insertId);
                });
              }
              if (role === ROLES.client && insertResult?.insertId) {
                notify.fire(() => notify.sendWelcomeClient(insertResult.insertId));
              }
              res.status(201).json({
                message: "Utilisateur inscrit avec succès"
              });
            }
          );
        });
      }
    );
  };
}

function handleLogin(expectedRole) {
  return (req, res) => {
    const { email, mot_de_passe } = req.body;

    if (!email || !mot_de_passe) {
      return res.status(400).json({ message: "Email et mot de passe requis." });
    }

    db.query(
      "SELECT * FROM utilisateurs WHERE email = ?",
      [email.trim().toLowerCase()],
      (err, result) => {
        if (err) return res.status(500).json({ message: "Erreur serveur" });
        if (result.length === 0) {
          return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        const user = result[0];

        if (user.role !== expectedRole) {
          return res.status(403).json({
            message: wrongRoleMessage(expectedRole, user.role)
          });
        }

        if (!user.mot_de_passe) {
          return res.status(400).json({
            message:
              "Ce compte utilise la connexion Google. Cliquez sur « Continuer avec Google »."
          });
        }

        bcrypt.compare(mot_de_passe, user.mot_de_passe, (errBcrypt, isMatch) => {
          if (errBcrypt) return res.status(500).json({ message: "Erreur bcrypt" });
          if (!isMatch) return res.status(401).json({ message: "Mot de passe incorrect" });

          if (expectedRole === ROLES.admin) {
            notify.fire(() => notify.sendWelcomeAdmin(user.id));
          }

          res.json(buildAuthResponse(user));
        });
      }
    );
  };
}

// ======================
// CLIENT
// ======================
router.post("/auth/client/register", handleRegister(ROLES.client));
router.post("/auth/client/login", handleLogin(ROLES.client));

// ======================
// PROPRIETAIRE
// ======================
router.post("/auth/proprietaire/register", handleRegister(ROLES.proprietaire));
router.post("/auth/proprietaire/login", handleLogin(ROLES.proprietaire));

// ======================
// ADMIN (connexion uniquement)
// ======================
router.post("/auth/admin/login", handleLogin(ROLES.admin));

// ======================
// Anciennes routes (compatibilité)
// ======================
router.post("/register", (req, res) => {
  const role =
    req.body.role === ROLES.proprietaire ? ROLES.proprietaire : ROLES.client;
  req.body = { ...req.body, role: undefined };
  handleRegister(role)(req, res);
});

router.post("/login", (req, res) => {
  const { email, mot_de_passe } = req.body;

  if (!email || !mot_de_passe) {
    return res.status(400).json({ message: "Email et mot de passe requis." });
  }

  db.query(
    "SELECT * FROM utilisateurs WHERE email = ?",
    [email.trim().toLowerCase()],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });
      if (result.length === 0) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      const user = result[0];

      if (!user.mot_de_passe) {
        return res.status(400).json({
          message:
            "Ce compte utilise la connexion Google. Cliquez sur « Continuer avec Google »."
        });
      }

      bcrypt.compare(mot_de_passe, user.mot_de_passe, (errBcrypt, isMatch) => {
        if (errBcrypt) return res.status(500).json({ message: "Erreur bcrypt" });
        if (!isMatch) return res.status(401).json({ message: "Mot de passe incorrect" });

        res.json(buildAuthResponse(user));
      });
    }
  );
});

// ======================
// GOOGLE SIGN-IN
// ======================
router.post("/auth/google", async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({
      message:
        "Connexion Google non configurée. Ajoutez GOOGLE_CLIENT_ID dans le fichier .env du serveur."
    });
  }

  const { credential, role: requestedRole } = req.body;

  if (!credential) {
    return res.status(400).json({ message: "Token Google manquant." });
  }

  const allowedRoles = [ROLES.client, ROLES.proprietaire];
  const finalRole = allowedRoles.includes(requestedRole)
    ? requestedRole
    : ROLES.client;

  try {
    const payload = await verifyGoogleIdToken(credential);
    const googleId = payload.sub;
    const email = (payload.email || "").toLowerCase();
    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true";

    if (!email) {
      return res.status(400).json({ message: "Email Google non disponible." });
    }

    if (emailVerified === false) {
      return res.status(400).json({ message: "Email Google non vérifié." });
    }

    const prenom = payload.given_name || "Utilisateur";
    const nom = payload.family_name || "Google";

    let users = await dbQuery(
      "SELECT * FROM utilisateurs WHERE google_id = ? LIMIT 1",
      [googleId]
    );

    if (users.length === 0) {
      users = await dbQuery(
        "SELECT * FROM utilisateurs WHERE email = ? LIMIT 1",
        [email]
      );
    }

    let user;

    if (users.length > 0) {
      user = users[0];

      if (!user.google_id) {
        await dbQuery("UPDATE utilisateurs SET google_id = ? WHERE id = ?", [
          googleId,
          user.id
        ]);
        user.google_id = googleId;
      }

      if (user.role !== finalRole) {
        return res.status(403).json({
          message: wrongRoleMessage(finalRole, user.role)
        });
      }
    } else {
      await dbQuery(
        `INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role, google_id)
         VALUES (?, ?, ?, NULL, ?, ?)`,
        [nom, prenom, email, finalRole, googleId]
      );

      const created = await dbQuery(
        "SELECT * FROM utilisateurs WHERE google_id = ? LIMIT 1",
        [googleId]
      );
      user = created[0];
      if (finalRole === ROLES.proprietaire && user?.id) {
        notify.fire(async () => {
          await notify.sendWelcomeProprietaire(user.id);
          await notify.sendProprietaireInscrit(user.id);
        });
      }
      if (finalRole === ROLES.client && user?.id) {
        notify.fire(() => notify.sendWelcomeClient(user.id));
      }
    }

    if (user?.role === ROLES.admin) {
      notify.fire(() => notify.sendWelcomeAdmin(user.id));
    }

    res.json(buildAuthResponse(user));
  } catch (err) {
    console.error("Google auth:", err);
    res.status(401).json({ message: "Connexion Google invalide ou expirée." });
  }
});

router.get("/config", (req, res) => {
  res.json({
    googleClientId: GOOGLE_CLIENT_ID || null,
    googleEnabled: Boolean(GOOGLE_CLIENT_ID)
  });
});

function sanitizeUser(row) {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    email: row.email,
    role: row.role,
    isGoogle: Boolean(row.google_id),
    hasPassword: Boolean(row.mot_de_passe)
  };
}

router.get("/profil", verifierToken, async (req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT id, nom, prenom, email, role, google_id, mot_de_passe
       FROM utilisateurs WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.put("/profil", verifierToken, async (req, res) => {
  const { nom, prenom, email } = req.body;

  if (!nom?.trim() || !prenom?.trim() || !email?.trim()) {
    return res.status(400).json({ message: "Nom, prénom et email sont obligatoires." });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const existing = await dbQuery(
      "SELECT id FROM utilisateurs WHERE email = ? AND id <> ? LIMIT 1",
      [cleanEmail, req.user.id]
    );

    if (existing.length) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }

    await dbQuery(
      "UPDATE utilisateurs SET nom = ?, prenom = ?, email = ? WHERE id = ?",
      [nom.trim(), prenom.trim(), cleanEmail, req.user.id]
    );

    const rows = await dbQuery(
      `SELECT id, nom, prenom, email, role, google_id, mot_de_passe
       FROM utilisateurs WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    res.json({
      message: "Profil mis à jour.",
      user: sanitizeUser(rows[0])
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.put("/profil/password", verifierToken, async (req, res) => {
  const { mot_de_passe_actuel, mot_de_passe_nouveau } = req.body;

  if (!mot_de_passe_nouveau || mot_de_passe_nouveau.length < 6) {
    return res.status(400).json({
      message: "Le nouveau mot de passe doit contenir au moins 6 caractères."
    });
  }

  try {
    const rows = await dbQuery(
      "SELECT mot_de_passe FROM utilisateurs WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    const user = rows[0];

    if (user.mot_de_passe) {
      if (!mot_de_passe_actuel) {
        return res.status(400).json({ message: "Mot de passe actuel requis." });
      }

      const match = await bcrypt.compare(mot_de_passe_actuel, user.mot_de_passe);
      if (!match) {
        return res.status(401).json({ message: "Mot de passe actuel incorrect." });
      }
    }

    const hash = await bcrypt.hash(mot_de_passe_nouveau, 10);
    await dbQuery("UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?", [
      hash,
      req.user.id
    ]);

    res.json({ message: "Mot de passe modifié avec succès." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.delete("/profil", verifierToken, async (req, res) => {
  const { mot_de_passe, confirmation } = req.body;

  if (confirmation !== "SUPPRIMER") {
    return res.status(400).json({
      message: 'Tapez "SUPPRIMER" pour confirmer la suppression du compte.'
    });
  }

  try {
    const rows = await dbQuery(
      `SELECT id, role, mot_de_passe, google_id
       FROM utilisateurs WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    const user = rows[0];

    if (user.mot_de_passe) {
      if (!mot_de_passe) {
        return res.status(400).json({ message: "Mot de passe requis pour supprimer le compte." });
      }

      const match = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
      if (!match) {
        return res.status(401).json({ message: "Mot de passe incorrect." });
      }
    }

    if (user.role === "proprietaire") {
      const hotels = await dbQuery(
        "SELECT COUNT(*) AS total FROM hotels WHERE id_proprietaire = ?",
        [user.id]
      );
      if (hotels[0].total > 0) {
        return res.status(400).json({
          message:
            "Supprimez d'abord vos hôtels ou contactez le support avant de fermer votre compte propriétaire."
        });
      }
    }

    if (user.role === "client") {
      const activeRes = await dbQuery(
        `SELECT COUNT(*) AS total FROM reservations
         WHERE id_client = ? AND statut NOT IN ('annulee', 'refusee')`,
        [user.id]
      );
      if (activeRes[0].total > 0) {
        return res.status(400).json({
          message:
            "Vous avez des réservations en cours. Annulez-les avant de supprimer votre compte."
        });
      }

      await dbQuery("DELETE FROM reservations WHERE id_client = ?", [user.id]);
    }

    await dbQuery("DELETE FROM utilisateurs WHERE id = ?", [user.id]);

    res.json({ message: "Compte supprimé définitivement." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
