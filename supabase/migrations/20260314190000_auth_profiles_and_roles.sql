DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'customer_role'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.customer_role AS ENUM ('customer', 'admin', 'super_admin');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.customer_roles (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  role public.customer_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_customer_roles_role ON public.customer_roles (role);

ALTER TABLE public.customer_roles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_customer_roles_updated_at ON public.customer_roles;
CREATE TRIGGER update_customer_roles_updated_at
BEFORE UPDATE ON public.customer_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

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
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'EMAIL_ALREADY_IN_USE';
  END IF;

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

CREATE OR REPLACE FUNCTION public.get_current_customer_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.customer_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role
  INTO v_role
  FROM public.customer_roles
  WHERE customer_id = auth.uid()
  LIMIT 1;

  RETURN v_role::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_customer_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_customer_role() TO authenticated;

