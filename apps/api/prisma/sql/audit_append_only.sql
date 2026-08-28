-- Run once per environment, as a superuser, AFTER `prisma migrate deploy`.
-- Makes the audit trail append-only for the application role: the app can insert
-- and read audit rows but cannot rewrite or delete history.
--
-- Migrations must run as a different (owner) role than the application.
--
--   psql "$DATABASE_URL" -v app_role=servicedesk_app -f audit_append_only.sql

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM PUBLIC;

DO $$
DECLARE
  app_role text := current_setting('app.role_name', true);
BEGIN
  IF app_role IS NULL THEN
    app_role := 'servicedesk_app';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    EXECUTE format('GRANT SELECT, INSERT ON TABLE audit_logs TO %I', app_role);
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM %I', app_role);
  ELSE
    RAISE NOTICE 'Role % does not exist; skipping grants', app_role;
  END IF;
END
$$;

-- Belt and braces: block row rewrites even for roles that hold UPDATE/DELETE.
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (attempted %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_mutate ON audit_logs;
CREATE TRIGGER audit_logs_no_mutate
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
