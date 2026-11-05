CREATE TABLE public.deleted_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL,
  data jsonb NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by_id uuid,
  deleted_by text
);
GRANT SELECT ON public.deleted_interventions TO authenticated;
GRANT ALL ON public.deleted_interventions TO service_role;
ALTER TABLE public.deleted_interventions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read deletions" ON public.deleted_interventions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_intervention_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j jsonb := auth.jwt();
BEGIN
  INSERT INTO public.deleted_interventions (intervention_id, data, deleted_by_id, deleted_by)
  VALUES (OLD.id, to_jsonb(OLD), auth.uid(),
    COALESCE(j->'user_metadata'->>'name', j->'user_metadata'->>'username', j->>'email'));
  RETURN OLD;
END $$;
CREATE TRIGGER log_intervention_delete BEFORE DELETE ON public.interventions
FOR EACH ROW EXECUTE FUNCTION public.log_intervention_delete();