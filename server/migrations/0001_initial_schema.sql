CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'ignored');
CREATE TYPE alert_type AS ENUM ('price_increase', 'renewal', 'duplicate', 'unused');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant VARCHAR(255) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  date DATE NOT NULL,
  raw_description TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE detected_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant VARCHAR(255) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  frequency VARCHAR(32) NOT NULL,
  category VARCHAR(80),
  first_seen DATE NOT NULL,
  last_seen DATE NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active'
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES detected_subscriptions(id) ON DELETE SET NULL,
  type alert_type NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX transactions_user_date_idx ON transactions(user_id, date DESC);
CREATE INDEX subscriptions_user_idx ON detected_subscriptions(user_id);
CREATE INDEX alerts_user_created_idx ON alerts(user_id, created_at DESC);
