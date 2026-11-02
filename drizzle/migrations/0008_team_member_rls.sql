CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'user');

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['daily_tasks','intervention_types','interventions','job_monitoring','job_results','job_templates','members','messages','shift_attendance','shifts','task_results','task_templates'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "signed in access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "team members access" ON public.%I FOR ALL TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()))', t);
  END LOOP;
END $$;