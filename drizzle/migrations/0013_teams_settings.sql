CREATE TABLE public.notification_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  teams_webhook_url text,
  teams_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage notification settings" ON public.notification_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.notification_settings (id) VALUES (1) ON CONFLICT DO NOTHING;