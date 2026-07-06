-- Ejecutar esto en el SQL Editor de Supabase

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salary DECIMAL(12,2) DEFAULT 0,
  savings_goal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE couple (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES users(id) NOT NULL,
  user2_id UUID REFERENCES users(id) NOT NULL,
  monthly_budget DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  couple_id UUID REFERENCES couple(id),
  amount DECIMAL(12,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT expense_owner CHECK (
    (user_id IS NOT NULL AND couple_id IS NULL) OR
    (user_id IS NULL AND couple_id IS NOT NULL)
  )
);

CREATE TABLE couple_deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID REFERENCES couple(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
