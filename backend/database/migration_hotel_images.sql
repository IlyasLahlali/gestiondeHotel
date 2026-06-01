-- Images hôtels : image principale + galerie
-- Exécuter sur la base gestion_hotel

ALTER TABLE hotels
ADD COLUMN image_principale VARCHAR(500) NULL
COMMENT 'Chemin relatif ex: /uploads/hotels/1/principale.jpg'
AFTER description;

CREATE TABLE IF NOT EXISTS hotel_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_hotel INT NOT NULL,
  chemin VARCHAR(500) NOT NULL,
  ordre INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hotel_images_hotel
    FOREIGN KEY (id_hotel) REFERENCES hotels(id) ON DELETE CASCADE,
  INDEX idx_hotel_images_hotel (id_hotel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
