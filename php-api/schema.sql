-- Executar no MySQL (phpMyAdmin ou cliente) após criar a base de dados.
-- CREATE DATABASE consorte_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ana_messages (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  text VARCHAR(512) NOT NULL,
  image_base64 LONGTEXT NOT NULL,
  created_at BIGINT NOT NULL,
  KEY idx_ana_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
