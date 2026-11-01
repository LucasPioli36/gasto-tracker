-- Makes a retried add request safe when the client loses the server response.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submission_key TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submission_identity TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submission_fingerprint TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submission_user_id UUID REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS expenses_submission_key_unique_idx
  ON expenses (submission_key)
  WHERE submission_key IS NOT NULL;

-- Backfill previous request keys, including the fingerprint format introduced in
-- the first review fix. The migration below aborts if any non-null key is unknown.
WITH parsed AS (
  SELECT
    id,
    string_to_array(submission_key, ':') AS parts
  FROM expenses
  WHERE submission_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}:([0-9a-fA-F]{64}:)?[0-9]+$'
)
UPDATE expenses AS e
SET
  submission_user_id = COALESCE(e.user_id, e.created_by),
  submission_identity = parsed.parts[1] || ':' || parsed.parts[array_length(parsed.parts, 1)],
  submission_fingerprint = CASE
    WHEN array_length(parsed.parts, 1) = 3 THEN parsed.parts[2]
    ELSE NULL
  END
FROM parsed
WHERE parsed.id = e.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM expenses
    WHERE submission_key IS NOT NULL
      AND (submission_identity IS NULL OR submission_user_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Cannot safely backfill all expense submission identities; inspect existing submission_key rows before retrying this migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM expenses
    WHERE submission_identity IS NOT NULL AND submission_user_id IS NOT NULL
    GROUP BY submission_user_id, submission_identity
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate expense submission identities exist; reconcile duplicate rows before creating the unique index.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_submission_identity_unique_idx
  ON expenses (submission_user_id, submission_identity)
  WHERE submission_identity IS NOT NULL AND submission_user_id IS NOT NULL;
