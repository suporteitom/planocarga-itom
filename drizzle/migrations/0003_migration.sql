CREATE TABLE public.job_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'job',
  job_name text NOT NULL,
  bi_folder text,
  environment text,
  shift text NOT NULL DEFAULT 'noite',
  cycle text NOT NULL DEFAULT 'Diário',
  run_time text,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_templates TO anon, authenticated;
GRANT ALL ON public.job_templates TO service_role;
ALTER TABLE public.job_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access v1" ON public.job_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.job_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.job_templates(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  result text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  UNIQUE (template_id, shift_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_results TO anon, authenticated;
GRANT ALL ON public.job_results TO service_role;
ALTER TABLE public.job_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access v1" ON public.job_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.job_templates REPLICA IDENTITY FULL;
ALTER TABLE public.job_results REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_results;
CREATE INDEX ON public.job_results(shift_date);