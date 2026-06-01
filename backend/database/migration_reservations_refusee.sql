-- Ajoute le statut « refusee » aux réservations (refus propriétaire)
-- Exécuter : mysql -u root -p gestion_hotel < migration_reservations_refusee.sql

ALTER TABLE reservations
  MODIFY COLUMN statut ENUM('en_attente', 'confirmee', 'refusee', 'annulee')
  NOT NULL DEFAULT 'en_attente';
