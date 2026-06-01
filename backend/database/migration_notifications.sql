-- Notifications utilisateurs (client, proprietaire, admin)
-- Exécuter sur la base gestion_hotel

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  role ENUM('client', 'proprietaire', 'admin') NOT NULL,
  type VARCHAR(60) NOT NULL,
  titre VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  lien VARCHAR(255) DEFAULT NULL,
  id_hotel INT DEFAULT NULL,
  id_reservation INT DEFAULT NULL,
  lue TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_utilisateur
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_hotel
    FOREIGN KEY (id_hotel) REFERENCES hotels(id) ON DELETE SET NULL,
  CONSTRAINT fk_notif_reservation
    FOREIGN KEY (id_reservation) REFERENCES reservations(id) ON DELETE SET NULL,
  INDEX idx_notif_user_lue (id_utilisateur, lue, created_at DESC),
  INDEX idx_notif_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
