DROP POLICY IF EXISTS "team members access" ON public.interventions;
CREATE POLICY "team members read" ON public.interventions FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "team members insert" ON public.interventions FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "team members update" ON public.interventions FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "admins delete" ON public.interventions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));