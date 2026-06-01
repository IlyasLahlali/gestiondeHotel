-- Conserve l'historique des réservations quand une chambre est supprimée.
-- Exécuter une fois : mysql -u root -p gestion_hotel < migration_chambre_reservations_history.sql

ALTER TABLE reservations
  MODIFY id_chambre INT NULL;

-- Supprime l'ancienne contrainte si elle existe (nom peut varier selon l'installation).
SET @fk_name := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reservations'
    AND COLUMN_NAME = 'id_chambre'
    AND REFERENCED_TABLE_NAME = 'chambres'
  LIMIT 1
);

SET @drop_fk_sql := IF(
  @fk_name IS NOT NULL,
  CONCAT('ALTER TABLE reservations DROP FOREIGN KEY `', @fk_name, '`'),
  'SELECT 1'
);

PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE reservations
  ADD CONSTRAINT fk_reservations_chambre
  FOREIGN KEY (id_chambre) REFERENCES chambres(id) ON DELETE SET NULL;
