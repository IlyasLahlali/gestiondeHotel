-- Favoris client (hôtels enregistrés)
-- Exécuter sur la base gestion_hotel

CREATE TABLE IF NOT EXISTS favoris (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_client INT NOT NULL,
  id_hotel INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_favoris_client_hotel (id_client, id_hotel),
  CONSTRAINT fk_favoris_client
    FOREIGN KEY (id_client) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  CONSTRAINT fk_favoris_hotel
    FOREIGN KEY (id_hotel) REFERENCES hotels(id) ON DELETE CASCADE,
  INDEX idx_favoris_client (id_client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
