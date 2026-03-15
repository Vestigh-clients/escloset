ALTER TABLE public.addresses
DROP CONSTRAINT IF EXISTS addresses_customer_id_fkey;

ALTER TABLE public.addresses
ADD CONSTRAINT addresses_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.customers(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.customers(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE public.discount_codes
DROP CONSTRAINT IF EXISTS discount_codes_customer_id_fkey;

ALTER TABLE public.discount_codes
ADD CONSTRAINT discount_codes_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.customers(id)
ON UPDATE CASCADE;

ALTER TABLE public.customer_roles
DROP CONSTRAINT IF EXISTS customer_roles_customer_id_fkey;

ALTER TABLE public.customer_roles
ADD CONSTRAINT customer_roles_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.customers(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE public.customer_roles
DROP CONSTRAINT IF EXISTS customer_roles_assigned_by_fkey;

ALTER TABLE public.customer_roles
ADD CONSTRAINT customer_roles_assigned_by_fkey
FOREIGN KEY (assigned_by)
REFERENCES public.customers(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE public.admin_activity_log
DROP CONSTRAINT IF EXISTS admin_activity_log_admin_id_fkey;

ALTER TABLE public.admin_activity_log
ADD CONSTRAINT admin_activity_log_admin_id_fkey
FOREIGN KEY (admin_id)
REFERENCES public.customers(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE public.site_settings
DROP CONSTRAINT IF EXISTS site_settings_updated_by_fkey;

ALTER TABLE public.site_settings
ADD CONSTRAINT site_settings_updated_by_fkey
FOREIGN KEY (updated_by)
REFERENCES public.customers(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.initialize_customer_profile(
  p_user_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_first_name TEXT := NULLIF(trim(COALESCE(p_first_name, '')), '');
  v_last_name TEXT := NULLIF(trim(COALESCE(p_last_name, '')), '');
  v_existing_customer_id UUID;
  v_auth_uid UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'USER_ID_REQUIRED';
  END IF;

  IF v_auth_uid IS NOT NULL AND v_auth_uid <> p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'NOT_ALLOWED';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EMAIL_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_user_id
      AND lower(email) = v_email
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTH_USER_NOT_FOUND';
  END IF;

  SELECT id
  INTO v_existing_customer_id
  FROM public.customers
  WHERE email = v_email
    AND id <> p_user_id
  LIMIT 1;

  IF v_existing_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET
      id = p_user_id,
      first_name = COALESCE(v_first_name, first_name),
      last_name = COALESCE(v_last_name, last_name),
      email = v_email,
      updated_at = now()
    WHERE id = v_existing_customer_id;
  ELSE
    INSERT INTO public.customers (id, first_name, last_name, email, email_verified)
    VALUES (
      p_user_id,
      COALESCE(v_first_name, 'Customer'),
      COALESCE(v_last_name, 'Account'),
      v_email,
      false
    )
    ON CONFLICT (id) DO UPDATE
    SET
      first_name = COALESCE(v_first_name, customers.first_name),
      last_name = COALESCE(v_last_name, customers.last_name),
      email = EXCLUDED.email,
      updated_at = now();
  END IF;

  INSERT INTO public.customer_roles (customer_id, role)
  VALUES (p_user_id, 'customer')
  ON CONFLICT (customer_id) DO NOTHING;

  RETURN jsonb_build_object(
    'customer_id', p_user_id,
    'email', v_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_customer_profile(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.initialize_customer_profile(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
