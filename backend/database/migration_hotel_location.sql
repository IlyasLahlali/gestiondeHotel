-- Coordonnées GPS pour les hôtels (carte / localisation)
ALTER TABLE hotels
  ADD COLUMN latitude DECIMAL(10, 8) NULL,
  ADD COLUMN longitude DECIMAL(11, 8) NULL;
