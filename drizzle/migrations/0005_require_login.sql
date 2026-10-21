DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['members','shifts','shift_attendance','messages','intervention_types','interventions','daily_tasks','job_monitoring','task_templates','task_results','job_templates','job_results'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS "open access v1" ON public.%I', t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  EXECUTE format('CREATE POLICY "signed in access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
END LOOP; END $$;
