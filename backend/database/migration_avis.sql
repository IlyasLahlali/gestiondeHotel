-- Avis clients sur les hôtels
-- Exécuter sur la base gestion_hotel

CREATE TABLE IF NOT EXISTS avis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  commentaire TEXT NOT NULL,
  note TINYINT NOT NULL,
  id_client INT NOT NULL,
  id_hotel INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_avis_client_hotel (id_client, id_hotel),
  CONSTRAINT fk_avis_client
    FOREIGN KEY (id_client) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  CONSTRAINT fk_avis_hotel
    FOREIGN KEY (id_hotel) REFERENCES hotels(id) ON DELETE CASCADE,
  CONSTRAINT chk_avis_note CHECK (note >= 1 AND note <= 5),
  INDEX idx_avis_hotel (id_hotel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
