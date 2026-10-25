BEGIN;

CREATE TABLE investment_portfolios (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  initial_invested_usd DECIMAL(14,2) NOT NULL CHECK (initial_invested_usd >= 0),
  initial_gain_usd DECIMAL(14,2) NOT NULL,
  initial_date DATE NOT NULL,
  units_owned DECIMAL(20,10) NOT NULL DEFAULT 0,
  units_initialized BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investment_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_usd DECIMAL(14,2) NOT NULL CHECK (amount_usd > 0),
  purchase_date DATE NOT NULL,
  price_usd DECIMAL(14,4) NOT NULL CHECK (price_usd > 0),
  units_added DECIMAL(20,10) NOT NULL CHECK (units_added > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investment_price_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL DEFAULT 'LON:CSPX' CHECK (symbol = 'LON:CSPX'),
  price_usd DECIMAL(14,4) NOT NULL CHECK (price_usd > 0),
  trade_at TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trading_date DATE NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'google_sheets'
);

CREATE INDEX investment_purchases_user_date_idx ON investment_purchases (user_id, purchase_date DESC);
CREATE INDEX investment_price_snapshots_date_idx ON investment_price_snapshots (trading_date DESC);

-- El servidor de la app usa la clave service_role. La API pública no debe exponer estos registros.
ALTER TABLE investment_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_price_snapshots ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION add_cspx_purchase(p_user_id UUID, p_amount NUMERIC, p_purchase_date DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_initial_date DATE;
  v_price NUMERIC;
  v_units NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Purchase amount must be positive';
  END IF;

  SELECT initial_date INTO v_initial_date
  FROM investment_portfolios
  WHERE user_id = p_user_id AND units_initialized = TRUE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio is not initialized';
  END IF;
  IF p_purchase_date < v_initial_date THEN
    RAISE EXCEPTION 'Purchase date precedes the initial balance';
  END IF;

  SELECT price_usd INTO v_price
  FROM investment_price_snapshots
  WHERE fetched_at >= NOW() - INTERVAL '5 days'
    AND trading_date >= CURRENT_DATE - 5
  ORDER BY trading_date DESC, fetched_at DESC
  LIMIT 1;
  IF NOT FOUND OR v_price <= 0 THEN
    RAISE EXCEPTION 'No current CSPX quote is available';
  END IF;

  v_units := p_amount / v_price;
  INSERT INTO investment_purchases (user_id, amount_usd, purchase_date, price_usd, units_added)
  VALUES (p_user_id, p_amount, p_purchase_date, v_price, v_units);

  UPDATE investment_portfolios
  SET units_owned = units_owned + v_units, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION add_cspx_purchase(UUID, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_cspx_purchase(UUID, NUMERIC, DATE) TO service_role;

COMMIT;
