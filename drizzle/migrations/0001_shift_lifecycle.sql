ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS started_by text;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS closed_by text;