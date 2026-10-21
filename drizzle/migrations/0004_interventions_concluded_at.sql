ALTER TABLE public.interventions ADD COLUMN IF NOT EXISTS concluded_at timestamptz;
UPDATE public.interventions SET concluded_at = updated_at WHERE status = 'concluida' AND concluded_at IS NULL;
CREATE OR REPLACE FUNCTION public.set_intervention_concluded_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'concluida' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida' OR NEW.concluded_at IS NULL THEN
      NEW.concluded_at := COALESCE(CASE WHEN TG_OP='UPDATE' AND OLD.status='concluida' THEN OLD.concluded_at END, now());
    END IF;
  ELSE
    NEW.concluded_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_intervention_concluded_at ON public.interventions;
CREATE TRIGGER trg_intervention_concluded_at BEFORE INSERT OR UPDATE ON public.interventions FOR EACH ROW EXECUTE FUNCTION public.set_intervention_concluded_at();