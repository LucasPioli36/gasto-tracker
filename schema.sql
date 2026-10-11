-- Esquema actual de la base (Supabase). Para crearla de cero: correr en el SQL Editor.
-- Los cambios sobre la base existente van en migrations/.

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

-- Un movimiento es individual (user_id) o de pareja (couple_id + created_by = quién lo cargó/pagó).
-- category: ver lib/categories.ts ('ahorro' y 'viajes' no cuentan como gasto del día a día).
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  couple_id UUID REFERENCES couple(id),
  created_by UUID REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  is_income BOOLEAN NOT NULL DEFAULT FALSE,
  is_investment BOOLEAN DEFAULT FALSE, -- existe en la base, la app no lo usa
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT expense_owner CHECK (
    (user_id IS NOT NULL AND couple_id IS NULL) OR
    (user_id IS NULL AND couple_id IS NOT NULL)
  ),
  CONSTRAINT couple_expense_has_creator CHECK (couple_id IS NULL OR created_by IS NOT NULL)
);
