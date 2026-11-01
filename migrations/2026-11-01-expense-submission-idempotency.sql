-- Makes a retried add request safe when the client loses the server response.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submission_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_submission_key_unique_idx
  ON expenses (submission_key)
  WHERE submission_key IS NOT NULL;
