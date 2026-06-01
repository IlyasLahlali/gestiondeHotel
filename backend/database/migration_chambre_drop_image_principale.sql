-- Retire image_principale des chambres (galerie chambre_images uniquement)

ALTER TABLE chambres DROP COLUMN image_principale;
