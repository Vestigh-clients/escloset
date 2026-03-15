ALTER TABLE public.customer_roles
ADD COLUMN IF NOT EXISTS id UUID;

UPDATE public.customer_roles
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.customer_roles
ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.customer_roles
ALTER COLUMN id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_roles_id ON public.customer_roles (id);

ALTER TABLE public.customer_roles
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.customer_roles
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

UPDATE public.customer_roles
SET assigned_at = COALESCE(assigned_at, created_at, now())
WHERE assigned_at IS NULL;

ALTER TABLE public.customer_roles
ALTER COLUMN assigned_at SET DEFAULT now();

ALTER TABLE public.customer_roles
ALTER COLUMN assigned_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_is_super_admin BOOLEAN := false;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = v_uid
      AND role = 'super_admin'
  )
  INTO v_is_super_admin;

  RETURN COALESCE(v_is_super_admin, false);
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_customer_role(
  target_customer_id UUID,
  new_role public.customer_role
)
RETURNS public.customer_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
BEGIN
  IF v_actor_id IS NULL OR NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'NOT_ALLOWED';
  END IF;

  IF target_customer_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TARGET_REQUIRED';
  END IF;

  IF new_role IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ROLE_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customers
    WHERE id = target_customer_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOMER_NOT_FOUND';
  END IF;

  INSERT INTO public.customer_roles (
    customer_id,
    role,
    assigned_by,
    assigned_at
  )
  VALUES (
    target_customer_id,
    new_role,
    v_actor_id,
    now()
  )
  ON CONFLICT (customer_id) DO UPDATE
  SET
    role = EXCLUDED.role,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = EXCLUDED.assigned_at,
    updated_at = now();

  RETURN new_role;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_customer_role(UUID, public.customer_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_customer_role(UUID, public.customer_role) TO authenticated;

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.customers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_site_settings_updated_at ON public.site_settings (updated_at DESC);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.site_settings (key, value)
VALUES
  ('site_name', 'Luxuriant'),
  ('site_tagline', ''),
  ('support_email', ''),
  ('support_phone', ''),
  ('whatsapp_number', ''),
  ('free_shipping_threshold', '0'),
  ('order_number_prefix', 'LUX'),
  ('default_currency', 'GHS'),
  ('new_order_email', ''),
  ('low_stock_email', ''),
  ('weekly_summary_email', '')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "admin read customers" ON public.customers;
CREATE POLICY "admin read customers"
ON public.customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_roles
    WHERE customer_id = auth.uid()
    AND role IN ('admin','super_admin')
  )
);

DROP POLICY IF EXISTS "admin update customers" ON public.customers;
CREATE POLICY "admin update customers"
ON public.customers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.customer_roles
    WHERE customer_id = auth.uid()
    AND role IN ('admin','super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_roles
    WHERE customer_id = auth.uid()
    AND role IN ('admin','super_admin')
  )
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manage discounts" ON public.discount_codes;
CREATE POLICY "admin manage discounts"
ON public.discount_codes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.customer_roles
    WHERE customer_id = auth.uid()
    AND role IN ('admin','super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_roles
    WHERE customer_id = auth.uid()
    AND role IN ('admin','super_admin')
  )
);

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manage shipping" ON public.shipping_rates;
CREATE POLICY "admin manage shipping"
ON public.shipping_rates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.customer_roles
    WHERE customer_id = auth.uid()
    AND role IN ('admin','super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_roles
    WHERE customer_id = auth.uid()
    AND role IN ('admin','super_admin')
  )
);

DROP POLICY IF EXISTS "super_admin settings" ON public.site_settings;
CREATE POLICY "super_admin settings"
ON public.site_settings FOR ALL
USING (public.current_user_is_super_admin())
WITH CHECK (public.current_user_is_super_admin());

DROP POLICY IF EXISTS "super_admin manage roles" ON public.customer_roles;
CREATE POLICY "super_admin manage roles"
ON public.customer_roles FOR ALL
USING (public.current_user_is_super_admin())
WITH CHECK (public.current_user_is_super_admin());

DROP POLICY IF EXISTS "admin read activity" ON public.admin_activity_log;
DROP POLICY IF EXISTS "admin read activity log" ON public.admin_activity_log;
CREATE POLICY "admin read activity"
ON public.admin_activity_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_roles
    WHERE customer_id = auth.uid()
    AND role IN ('admin','super_admin')
  )
);

