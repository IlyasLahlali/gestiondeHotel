-- Galerie photos par chambre (sans image principale dédiée)
-- Exécuter sur la base gestion_hotel

CREATE TABLE IF NOT EXISTS chambre_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_chambre INT NOT NULL,
  chemin VARCHAR(500) NOT NULL,
  ordre INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chambre_images_chambre
    FOREIGN KEY (id_chambre) REFERENCES chambres(id) ON DELETE CASCADE,
  INDEX idx_chambre_images_chambre (id_chambre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
