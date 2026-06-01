const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

const verifierToken = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).send("Accès refusé : token manquant");    //Vérification si Token existe
  }

  const token = header.split(" ")[1]; // Bearer TOKEN

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // on stocke les infos utilisateur dans req
    req.user = decoded;

    next(); // passer à la route suivante
  } catch (error) {
    return res.status(403).send("Token invalide ou expiré");
  }
};

module.exports = verifierToken;


// Ce que fait ce code Vérifie si TOKEN existe et valide / Vérifie l'expiration (TOKEN s'expire pendant 2h) / récupère id + role utilisateur / bloque ou autorise accès

