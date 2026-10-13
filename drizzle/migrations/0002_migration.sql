CREATE TABLE public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'Tarefas Diárias ITOM',
  shift text NOT NULL DEFAULT 'noite',
  cycle text NOT NULL DEFAULT 'DIÁRIO',
  time_start text,
  time_end text,
  title text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO anon, authenticated;
GRANT ALL ON public.task_templates TO service_role;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access v1" ON public.task_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.task_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  result text NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  UNIQUE (template_id, shift_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_results TO anon, authenticated;
GRANT ALL ON public.task_results TO service_role;
ALTER TABLE public.task_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access v1" ON public.task_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.task_templates REPLICA IDENTITY FULL;
ALTER TABLE public.task_results REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_templates, public.task_results;

INSERT INTO public.task_templates (category, shift, cycle, time_start, time_end, title, sort) VALUES
('Tarefas Diárias ITOM','noite','DIÁRIO','23:00','01:00','CTT - Validação Sistemas SAP após Backup',10),
('Tarefas Diárias ITOM','noite','DIÁRIO','05:00','07:00','BLUEPRISM',20),
('Tarefas Diárias ITOM','manha','DIÁRIO','07:00','08:00','Envio do Ponto de Situação',30),
('Tarefas Diárias ITOM','tarde','DIÁRIO','14:50','15:00','Envio do Ponto de Situação',40),
('Aplicacional - CTT','manha','DIÁRIO',NULL,NULL,'Instalações de SW',10),
('Requests/Transportes - CTT','manha','DIÁRIO',NULL,NULL,'Transportes',10),
('Tarefas Esporádicas Processamentos','manha','Mensal',NULL,NULL,'Interfaces SAP CTT Mensais',10),
('Tarefas Esporádicas Updates','noite','Mensal',NULL,NULL,'Windows CTT - Updates/Reboot',10);