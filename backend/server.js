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


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
  console.log(`Frontend public : /Public/html/index.html`);
});