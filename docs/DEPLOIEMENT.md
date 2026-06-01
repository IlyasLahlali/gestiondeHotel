# Déploiement GitHub + Render — HôtelFacile Smart

Guide pas à pas pour obtenir un **lien public** à partager avec votre professeur.

---

## Vue d'ensemble

```
[Votre PC] → GitHub (code) → Render (serveur Node.js) → MySQL cloud (base de données)
```

**URLs finales (exemple) :**
- Accueil : `https://hotelfacile-smart.onrender.com/Public/html/index.html`
- Admin : `https://hotelfacile-smart.onrender.com/Admin/html/login.html`
- Client : `https://hotelfacile-smart.onrender.com/Client/html/login.html`
- Propriétaire : `https://hotelfacile-smart.onrender.com/Proprietaire/html/login.html`

---

## PARTIE A — Préparer le projet (déjà fait en grande partie)

Le code a été adapté pour la production :
- URLs API dynamiques (`runtimeConfig.js` + `/api` relatif)
- Base MySQL configurable via variables d'environnement
- `npm start` dans `backend/package.json`
- `.gitignore` (pas de `.env` sur GitHub)

**À vérifier chez vous :**
1. MySQL local fonctionne avec vos données de démo
2. `cd backend && node server.js` → l'app marche sur `http://localhost:3000`

---

## PARTIE B — Mettre le projet sur GitHub

### Étape 1 : Installer Git
- Télécharger : https://git-scm.com/download/win
- Redémarrer le terminal après installation

### Étape 2 : Créer un compte GitHub
- https://github.com → Sign up (gratuit)

### Étape 3 : Créer un nouveau dépôt
1. GitHub → **New repository**
2. Nom : `gestion-hotel` ou `hotelfacile-smart`
3. **Public** (plus simple pour Render gratuit)
4. Ne pas cocher « Add README » si le projet existe déjà
5. **Create repository**

### Étape 4 : Pousser le code (PowerShell)

```powershell
cd C:\Users\ilyas\Desktop\gestion-hotel

git init
git add .
git commit -m "Préparation déploiement Render - HôtelFacile Smart"

git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/gestion-hotel.git
git push -u origin main
```

Remplacez `VOTRE_USERNAME` par votre identifiant GitHub.

> **Important :** le fichier `backend/.env` n'est **pas** envoyé (`.gitignore`). Les secrets iront sur Render.

---

## PARTIE C — Base MySQL dans le cloud

Render ne propose pas toujours MySQL gratuit. Options recommandées :

### Option 1 — Railway (simple, crédit gratuit)
1. https://railway.app → compte GitHub
2. **New Project** → **Provision MySQL**
3. Onglet **Variables** → noter :
   - `MYSQLHOST` → `DB_HOST`
   - `MYSQLPORT` → `DB_PORT`
   - `MYSQLUSER` → `DB_USER`
   - `MYSQLPASSWORD` → `DB_PASSWORD`
   - `MYSQLDATABASE` → `DB_NAME`

### Option 2 — Aiven (MySQL gratuit limité)
1. https://aiven.io → free tier MySQL
2. Récupérer host, port, user, password, database
3. Activer SSL → `DB_SSL=true` sur Render

### Étape : Importer votre base locale

Sur votre PC (MySQL installé) :

```powershell
# Exporter la base locale
mysqldump -u root gestion_hotel > gestion_hotel.sql

# Importer vers le cloud (exemple Railway)
mysql -h VOTRE_HOST -P VOTRE_PORT -u VOTRE_USER -p VOTRE_DB < gestion_hotel.sql
```

Exécuter aussi les fichiers dans `backend/database/migration_*.sql` si la base cloud est vide.

**Créer un compte admin de démo** si besoin (via votre app locale ou SQL).

---

## PARTIE D — Déployer sur Render

### Étape 1 : Compte Render
1. https://render.com → **Get Started** → connexion **GitHub**
2. Autoriser l'accès au dépôt `gestion-hotel`

### Étape 2 : Créer le Web Service
1. **Dashboard** → **New +** → **Web Service**
2. Sélectionner le repo **gestion-hotel**
3. Configurer :

| Champ | Valeur |
|--------|--------|
| **Name** | `hotelfacile-smart` |
| **Region** | Frankfurt (ou le plus proche) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

### Étape 3 : Variables d'environnement (Environment)

Dans **Environment** → **Add Environment Variable** :

| Clé | Valeur |
|-----|--------|
| `JWT_SECRET` | Une longue chaîne aléatoire (ex. 64 caractères) |
| `GOOGLE_CLIENT_ID` | Votre client ID Google (optionnel) |
| `DB_HOST` | Host MySQL cloud |
| `DB_PORT` | `3306` (ou port fourni) |
| `DB_USER` | Utilisateur MySQL |
| `DB_PASSWORD` | Mot de passe MySQL |
| `DB_NAME` | `gestion_hotel` |
| `DB_SSL` | `true` si le fournisseur l'exige, sinon `false` |

`PORT` est injecté automatiquement par Render.

### Étape 4 : Déployer
1. **Create Web Service**
2. Attendre 5–10 min (premier build)
3. URL affichée : `https://hotelfacile-smart.onrender.com`

### Étape 5 : Tester
- Ouvrir : `https://VOTRE-APP.onrender.com/Public/html/index.html`
- Se connecter en admin / client / propriétaire

---

## PARTIE E — Google OAuth (optionnel)

Si vous utilisez « Continuer avec Google » :

1. [Google Cloud Console](https://console.cloud.google.com/) → Credentials
2. OAuth Client ID → **Authorized JavaScript origins** :
   - `https://hotelfacile-smart.onrender.com`
3. Copier le Client ID dans `GOOGLE_CLIENT_ID` sur Render
4. Redéployer (ou Render redéploie auto)

---

## PARTIE F — Partager avec le professeur

Envoyer un email / document avec :

```
Application : HôtelFacile Smart
URL : https://hotelfacile-smart.onrender.com/Public/html/index.html

Comptes de démonstration :
- Admin : admin@... / motdepasse
- Client : client@... / motdepasse
- Propriétaire : owner@... / motdepasse

Parcours suggéré :
1. Accueil public → recherche Marrakech
2. Connexion client → réservation
3. Connexion propriétaire → valider réservation
4. Connexion admin → modération hôtels
```

---

## Limitations plan gratuit Render

| Point | Détail |
|-------|--------|
| **Mise en veille** | Après ~15 min sans visite, le serveur s'endort → 30–50 s au 1er clic |
| **Uploads images** | Disque éphémère : les images uploadées peuvent disparaître au redéploiement |
| **MySQL** | Hébergé séparément (Railway / Aiven) |

Pour un projet académique, c'est en général suffisant.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| « Erreur connexion DB » | Vérifier `DB_*` sur Render, SSL, IP autorisée chez le fournisseur MySQL |
| Page blanche / API failed | F12 → Network : l'URL doit être `/api/...` sur le même domaine |
| 502 Bad Gateway | Voir les **Logs** Render → erreur Node ou port |
| Google login ne marche pas | Origines autorisées + `GOOGLE_CLIENT_ID` |

---

## Mises à jour après modification du code

```powershell
cd C:\Users\ilyas\Desktop\gestion-hotel
git add .
git commit -m "Description des changements"
git push
```

Render redéploie automatiquement en 2–5 minutes.

---

## Checklist finale

- [ ] Code sur GitHub (sans `.env`)
- [ ] MySQL cloud avec données + comptes démo
- [ ] Web Service Render configuré (`Root Directory = backend`)
- [ ] Variables d'environnement définies
- [ ] URL testée dans le navigateur
- [ ] Lien + identifiants envoyés au professeur
- [ ] Lien ajouté dans le rapport de projet
