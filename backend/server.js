require("./config/env");
const express = require("express");
const cors = require("cors");
const path = require("path");
const { PORT } = require("./config/env");
const db = require('./config/db');
const hotelRoutes = require('./routes/hotelRoutes');
const hotelImageRoutes = require('./routes/hotelImageRoutes');
const chambreRoutes = require('./routes/chambreRoutes');
const chambreImageRoutes = require('./routes/chambreImageRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const statistiqueRoutes = require('./routes/statistiqueRoutes');
const favorisRoutes = require('./routes/favorisRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const avisRoutes = require('./routes/avisRoutes');





const authRoutes = require('./routes/authRoutes');


const app = express();

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath, {
  setHeaders(res, filePath) {
    if (/\.(html|css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

//authRoutes
app.use('/api', authRoutes);

//hotelRoutes
app.use('/api', hotelRoutes);
app.use('/api', hotelImageRoutes);

//chambreRoutes
app.use('/api', chambreRoutes);
app.use('/api', chambreImageRoutes);

//reservationRoutes
app.use('/api', reservationRoutes);

//statistiqueRoutes
app.use('/api', statistiqueRoutes);

//favorisRoutes
app.use('/api', favorisRoutes);

//notificationRoutes
app.use('/api', notificationRoutes);

//avisRoutes
app.use('/api', avisRoutes);

app.get('/api/health', (req, res) => {
  db.query('SELECT 1 AS ok', (err) => {
    if (err) {
      return res.status(503).json({
        ok: false,
        error: err.message,
        code: err.code
      });
    }
    db.query('SELECT COUNT(*) AS users FROM utilisateurs', (err2, rows) => {
      if (err2) {
        return res.status(503).json({
          ok: false,
          error: err2.message,
          code: err2.code,
          hint: 'Tables manquantes ? Ré-exécutez init_railway_complet.sql sur Railway MySQL.'
        });
      }
      res.json({ ok: true, users: rows[0]?.users ?? 0 });
    });
  });
});

app.get('/', (req, res) => {
  res.send("API Gestion_Hotel fonctionne 🚀");
});


const listenPort = Number(process.env.PORT) || Number(PORT) || 3000;

const server = app.listen(listenPort, "0.0.0.0", () => {
  console.log(`Serveur lancé sur le port ${listenPort}`);
  console.log(`Frontend public : /Public/html/index.html`);
  console.log(`DB_HOST=${process.env.DB_HOST || "localhost"}`);
});

server.on("error", (err) => {
  console.error("Erreur démarrage serveur :", err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("uncaughtException :", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection :", err);
  process.exit(1);
});