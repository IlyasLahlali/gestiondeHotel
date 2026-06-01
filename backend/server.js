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
app.use(express.static(frontendPath));

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