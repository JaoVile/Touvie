CREATE TABLE IF NOT EXISTS notification_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL UNIQUE,
  name       text        NOT NULL,
  content    text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_templates"
  ON notification_templates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
