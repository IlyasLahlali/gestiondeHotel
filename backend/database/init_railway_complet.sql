-- HôtelFacile Smart — schéma complet + données de démo (Railway / production)
-- 1) Remplacez "railway" ci-dessous si MYSQLDATABASE a un autre nom (onglet Variables Railway)
-- 2) Exécutez tout le script dans MySQL Workbench (connexion Railway) ou Railway → Database

USE railway;

-- ========== TABLES DE BASE ==========

CREATE TABLE IF NOT EXISTS utilisateurs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    google_id VARCHAR(255) NULL UNIQUE,
    mot_de_passe VARCHAR(255) NULL,
    role ENUM('client', 'proprietaire', 'admin') DEFAULT 'client'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hotels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(255) NOT NULL,
    ville VARCHAR(100) NOT NULL,
    adresse TEXT NOT NULL,
    description TEXT,
    image_principale VARCHAR(500) NULL COMMENT 'Chemin relatif ex: /uploads/hotels/1/principale.jpg',
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    id_proprietaire INT NOT NULL,
    statut ENUM('en_attente', 'valide', 'refuse') DEFAULT 'en_attente',
    FOREIGN KEY (id_proprietaire) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chambres (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_hotel INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    prix DECIMAL(10, 2) NOT NULL,
    capacite INT NOT NULL,
    FOREIGN KEY (id_hotel) REFERENCES hotels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reservations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_chambre INT NULL,
    id_client INT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    statut ENUM('en_attente', 'confirmee', 'refusee', 'annulee') NOT NULL DEFAULT 'en_attente',
    FOREIGN KEY (id_chambre) REFERENCES chambres(id) ON DELETE SET NULL,
    FOREIGN KEY (id_client) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== TABLES AJOUTÉES PAR MIGRATIONS ==========

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

-- ========== DONNÉES DE DÉMO ==========
-- Mot de passe pour tous les comptes : Demo2026!

INSERT INTO utilisateurs (id, nom, prenom, email, mot_de_passe, role) VALUES
(1, 'Admin', 'Systeme', 'admin@hotelfacile.ma', '$2b$10$rmqquPdCEXJ0sI7Z6ulvpuvy8IfgNTghQHC4Nm5/zJ.50OXiMugyK', 'admin'),
(2, 'Alami', 'Youssef', 'client@hotelfacile.ma', '$2b$10$rmqquPdCEXJ0sI7Z6ulvpuvy8IfgNTghQHC4Nm5/zJ.50OXiMugyK', 'client'),
(3, 'Benjelloun', 'Sara', 'proprietaire@hotelfacile.ma', '$2b$10$rmqquPdCEXJ0sI7Z6ulvpuvy8IfgNTghQHC4Nm5/zJ.50OXiMugyK', 'proprietaire')
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO hotels (id, nom, ville, adresse, description, latitude, longitude, id_proprietaire, statut) VALUES
(1, 'Riad Atlas Palace', 'Marrakech', 'Derb Sidi Bouloukat, Médina', 'Riad authentique avec patio et piscine, au cœur de la médina.', 31.62950000, -7.98110000, 3, 'valide'),
(2, 'Hotel Corniche Casablanca', 'Casablanca', 'Boulevard de la Corniche, Ain Diab', 'Vue mer, chambres modernes près de la plage.', 33.57310000, -7.65980000, 3, 'valide'),
(3, 'Riad En Attente', 'Fès', 'Talaa Kebira, Médina', 'Nouvel hôtel en cours de validation par l''admin.', 34.03310000, -5.00030000, 3, 'en_attente')
ON DUPLICATE KEY UPDATE nom = VALUES(nom);

INSERT INTO chambres (id, id_hotel, type, prix, capacite) VALUES
(1, 1, 'Double', 850.00, 2),
(2, 1, 'Suite', 1450.00, 4),
(3, 2, 'Standard', 620.00, 2),
(4, 2, 'Deluxe', 980.00, 3),
(5, 3, 'Simple', 400.00, 1)
ON DUPLICATE KEY UPDATE type = VALUES(type);

INSERT INTO reservations (id, id_chambre, id_client, date_debut, date_fin, statut) VALUES
(1, 1, 2, '2026-06-10', '2026-06-14', 'confirmee'),
(2, 3, 2, '2026-07-01', '2026-07-05', 'en_attente')
ON DUPLICATE KEY UPDATE statut = VALUES(statut);

INSERT INTO avis (id_client, id_hotel, note, commentaire) VALUES
(2, 1, 5, 'Excellent séjour, personnel très accueillant.')
ON DUPLICATE KEY UPDATE note = VALUES(note);

INSERT INTO favoris (id_client, id_hotel) VALUES
(2, 1)
ON DUPLICATE KEY UPDATE id_hotel = VALUES(id_hotel);
