CREATE TYPE auth_provider AS ENUM ('email', 'google', 'both');

ALTER TABLE users
  ADD COLUMN password_hash TEXT,
  ADD COLUMN auth_provider auth_provider NOT NULL DEFAULT 'email',
  ADD COLUMN google_id VARCHAR(255);

CREATE UNIQUE INDEX users_google_id_unique_idx ON users(google_id) WHERE google_id IS NOT NULL;
