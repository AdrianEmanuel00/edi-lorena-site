CREATE TABLE IF NOT EXISTS rsvps (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  response_type VARCHAR(24) NOT NULL,
  message TEXT NULL,
  submitted_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NULL,
  guest_count INT NOT NULL DEFAULT 0,
  primary_name VARCHAR(180) NOT NULL,
  guests_json LONGTEXT NOT NULL,
  INDEX idx_response_type (response_type),
  INDEX idx_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
