-- Connexion Google : google_id + mot de passe optionnel
USE gestion_hotel;

ALTER TABLE utilisateurs
  ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email;

ALTER TABLE utilisateurs
  MODIFY COLUMN mot_de_passe VARCHAR(255) NULL;
