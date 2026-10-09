CREATE TABLE public.members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.shifts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shift_date date NOT NULL, shift text NOT NULL CHECK (shift IN ('manha','tarde','noite')), created_at timestamptz NOT NULL DEFAULT now(), created_by text, UNIQUE(shift_date, shift));
CREATE TABLE public.shift_attendance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE, member_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by text, UNIQUE(shift_id, member_name));
CREATE TABLE public.messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text NOT NULL DEFAULT 'recados', shift_date date NOT NULL, shift text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), body text NOT NULL, author text, importance text NOT NULL DEFAULT 'normal', status text NOT NULL DEFAULT 'aberto', resolved_at timestamptz, resolved_by text, created_at timestamptz NOT NULL DEFAULT now(), created_by text, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text);
CREATE TABLE public.intervention_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.interventions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text, client text, ticket text, start_at timestamptz NOT NULL, end_at timestamptz, email_subject text, sent_by text, sent_at timestamptz, notes text, status text NOT NULL DEFAULT 'planejada', created_at timestamptz NOT NULL DEFAULT now(), created_by text, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text);
-- future tabs
CREATE TABLE public.daily_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shift_date date NOT NULL, shift text NOT NULL, title text NOT NULL, done boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), created_by text, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text);
CREATE TABLE public.job_monitoring (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shift_date date NOT NULL, shift text NOT NULL, job_name text NOT NULL, status text, notes text, created_at timestamptz NOT NULL DEFAULT now(), created_by text, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text);

DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['members','shifts','shift_attendance','messages','intervention_types','interventions','daily_tasks','job_monitoring'] LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY "open access v1" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
END LOOP; END $$;

INSERT INTO public.intervention_types(name) VALUES ('Deploy'),('Manutenção'),('Transporte'),('Reinício'),('Outros');
CREATE INDEX ON public.interventions(start_at);
CREATE INDEX ON public.messages(shift_date, shift);