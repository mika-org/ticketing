-- Optional defense-in-depth for deployments that use a transaction-pinned application role.
-- Run as database owner only after configuring every request/worker transaction with:
--   SET LOCAL app.tenant_id = '<tenant uuid>';
-- Super-admin and migration connections must use a separate BYPASSRLS owner role.
DO $policy$
DECLARE
  table_name text;
  tenant_tables text[] := ARRAY[
    'tenant_users', 'events', 'event_staff_assignments', 'ticket_types', 'add_ons',
    'add_on_options', 'ticket_type_add_ons', 'form_fields', 'form_field_options',
    'registrations', 'registration_items', 'registration_add_ons', 'registration_answers',
    'tickets', 'check_ins', 'payments'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $policy$;
