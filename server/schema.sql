-- Esquema de PibblePong
-- Ejecutar con:  sudo mysql < server/schema.sql   (o mysql -u root -p < server/schema.sql)

CREATE DATABASE IF NOT EXISTS pibblepong
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pibblepong;

-- Jugadores identificados por su tag (3-12 caracteres)
CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tag VARCHAR(12) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Cada partida terminada
CREATE TABLE IF NOT EXISTS scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  mode TINYINT NOT NULL,
  points INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  INDEX idx_mode_points (mode, points DESC),
  INDEX idx_player (player_id)
);

-- Usuario propio para la app (cambia la contraseña y ponla también en .env)
CREATE USER IF NOT EXISTS 'pibble'@'localhost' IDENTIFIED BY '123';
GRANT SELECT, INSERT ON pibblepong.* TO 'pibble'@'localhost';
FLUSH PRIVILEGES;
