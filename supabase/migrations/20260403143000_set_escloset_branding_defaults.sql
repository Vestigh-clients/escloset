INSERT INTO public.site_settings (key, value)
VALUES
  ('site_name', 'E & S closet'),
  ('site_url', 'https://escloset.vestigh.com')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
