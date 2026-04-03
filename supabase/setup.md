# E & S closet Supabase Setup (Fresh Client Project)

This guide is for provisioning a brand-new client backend from this codebase in under an hour.
It includes:

- Full table SQL (columns, defaults, constraints, indexes)
- Full RPC SQL for required functions
- Full RLS policy SQL
- Storage bucket setup and storage policies
- Edge function deployment + secrets
- Optional Google OAuth setup
- First `super_admin` bootstrap

## 1) Create a New Supabase Project

1. Go to Supabase and create a new project for the client.
2. Choose region and database password.
3. Wait for project provisioning.
4. Copy these values from Project Settings > API:
   - `Project URL`
   - `Publishable key` (anon key)
5. Use those in your frontend `.env` (see `.env.example`).

## 2) Frontend Environment Variables

1. Copy `.env.example` to `.env`.
2. Fill the values for the new client.

```env
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

# StyleSyncs API (Vestigh try-on)
VITE_STYLESYNC_API_KEY=
VITE_STYLESYNC_API_URL=

# Store identity (optional)
VITE_STORE_NAME=
```

## 3) Schema SQL (Tables, Constraints, Defaults, Indexes, Triggers, Views)

Run this in Supabase SQL Editor first.

```sql
-- Required extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- ENUMS
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'gender_type'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'prefer_not_to_say');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'order_status'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_status'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'refunded', 'partially_refunded');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'discount_type'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed_amount');
  END IF;
END
$$;

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

-- =====================
-- TABLES
-- =====================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  phone_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  avatar_url TEXT,
  date_of_birth DATE,
  gender public.gender_type,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0.00,
  last_order_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  price NUMERIC(10,2) NOT NULL,
  compare_at_price NUMERIC(10,2),
  cost_price NUMERIC(10,2),
  sku VARCHAR(100) UNIQUE,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  weight_grams INTEGER,
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  total_orders INTEGER DEFAULT 0,
  has_variants BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.product_option_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_option_type UNIQUE (product_id, name)
);

CREATE TABLE IF NOT EXISTS public.product_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type_id UUID NOT NULL REFERENCES public.product_option_types(id) ON DELETE CASCADE,
  value VARCHAR(100) NOT NULL,
  color_hex VARCHAR(7),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_option_value UNIQUE (option_type_id, value)
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label VARCHAR(255),
  price NUMERIC(10,2),
  compare_at_price NUMERIC(10,2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  sku VARCHAR(100),
  is_available BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_variant_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  option_type_id UUID NOT NULL REFERENCES public.product_option_types(id) ON DELETE CASCADE,
  option_value_id UUID NOT NULL REFERENCES public.product_option_values(id) ON DELETE CASCADE,
  CONSTRAINT unique_variant_option UNIQUE (variant_id, option_type_id)
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  label VARCHAR(50),
  recipient_name VARCHAR(200) NOT NULL,
  recipient_phone VARCHAR(20),
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  landmark VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
  postal_code VARCHAR(20),
  delivery_instructions TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  shipping_address_id UUID REFERENCES public.addresses(id) ON DELETE RESTRICT,
  shipping_address_snapshot JSONB NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_method VARCHAR(100),
  payment_reference VARCHAR(255),
  subtotal NUMERIC(10,2) NOT NULL,
  shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'GHS',
  notes TEXT,
  admin_notes TEXT,
  ip_address VARCHAR(45),
  mobile_money_number VARCHAR(20),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  confirmation_email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_image_url TEXT,
  unit_price NUMERIC(10,2) NOT NULL,
  compare_at_price NUMERIC(10,2),
  quantity INTEGER NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  variant_sku VARCHAR(100),
  variant_label VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status public.order_status,
  new_status public.order_status NOT NULL,
  changed_by VARCHAR(100),
  note TEXT,
  notified_customer BOOLEAN DEFAULT false,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipping_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  states JSONB DEFAULT '[]'::jsonb,
  base_rate NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  type public.discount_type NOT NULL,
  value NUMERIC(10,2) NOT NULL,
  minimum_order_amount NUMERIC(10,2) DEFAULT 0,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  customer_id UUID REFERENCES public.customers(id) ON UPDATE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.customer_roles (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  role public.customer_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE,
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  assigned_by UUID REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  link VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_table VARCHAR(100),
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.customers(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers (email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers (created_at);

CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON public.addresses (customer_id);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products (slug);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products (is_available);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products (is_featured);

CREATE INDEX IF NOT EXISTS idx_product_option_types_product_id ON public.product_option_types(product_id);
CREATE INDEX IF NOT EXISTS idx_product_option_values_option_type_id ON public.product_option_values(option_type_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_available ON public.product_variants(is_available);
CREATE INDEX IF NOT EXISTS idx_product_variants_display ON public.product_variants(product_id, display_order);
CREATE INDEX IF NOT EXISTS idx_product_variant_options_variant_id ON public.product_variant_options(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_options_option_value_id ON public.product_variant_options(option_value_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history (order_id);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes (code);

CREATE INDEX IF NOT EXISTS idx_customer_roles_role ON public.customer_roles (role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_roles_id ON public.customer_roles (id);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON public.admin_notifications (is_read);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_id ON public.admin_activity_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action ON public.admin_activity_log (action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON public.admin_activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_settings_updated_at ON public.site_settings (updated_at DESC);

-- =====================
-- SHARED FUNCTIONS + TRIGGERS
-- =====================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_addresses_updated_at ON public.addresses;
CREATE TRIGGER update_addresses_updated_at
BEFORE UPDATE ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipping_rates_updated_at ON public.shipping_rates;
CREATE TRIGGER update_shipping_rates_updated_at
BEFORE UPDATE ON public.shipping_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_discount_codes_updated_at ON public.discount_codes;
CREATE TRIGGER update_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_roles_updated_at ON public.customer_roles;
CREATE TRIGGER update_customer_roles_updated_at
BEFORE UPDATE ON public.customer_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    NEW.order_number := 'LUX-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('public.order_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_order_number ON public.orders;
CREATE TRIGGER set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();

-- =====================
-- AUTHORIZATION HELPERS
-- =====================
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF to_regclass('public.customer_roles') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE
    'SELECT EXISTS (
      SELECT 1
      FROM public.customer_roles
      WHERE customer_id = $1
      AND role IN (''admin'', ''super_admin'')
    )'
  INTO v_is_admin
  USING v_uid;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

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

-- =====================
-- PRODUCTS STOCK VIEW + SYNC
-- =====================
CREATE OR REPLACE VIEW public.products_with_stock AS
SELECT
  p.*,
  CASE
    WHEN COALESCE(p.has_variants, false) THEN (
      SELECT COALESCE(SUM(pv.stock_quantity), 0)
      FROM public.product_variants pv
      WHERE pv.product_id = p.id
        AND pv.is_available = true
    )
    ELSE p.stock_quantity
  END AS total_stock_quantity,
  CASE
    WHEN COALESCE(p.has_variants, false) THEN (
      EXISTS (
        SELECT 1
        FROM public.product_variants pv
        WHERE pv.product_id = p.id
          AND pv.is_available = true
          AND pv.stock_quantity > 0
      )
    )
    ELSE (
      p.stock_quantity > 0
      AND p.is_available = true
    )
  END AS in_stock
FROM public.products p;

CREATE OR REPLACE FUNCTION public.sync_product_stock_from_variants()
RETURNS TRIGGER AS $$
DECLARE
  target_product_id UUID;
BEGIN
  target_product_id := COALESCE(NEW.product_id, OLD.product_id);

  IF target_product_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.products
  SET
    stock_quantity = (
      SELECT COALESCE(SUM(stock_quantity), 0)
      FROM public.product_variants
      WHERE product_id = target_product_id
        AND is_available = true
    ),
    updated_at = now()
  WHERE id = target_product_id;

  IF TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    UPDATE public.products
    SET
      stock_quantity = (
        SELECT COALESCE(SUM(stock_quantity), 0)
        FROM public.product_variants
        WHERE product_id = OLD.product_id
          AND is_available = true
      ),
      updated_at = now()
    WHERE id = OLD.product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_product_stock_on_variant_change ON public.product_variants;
CREATE TRIGGER sync_product_stock_on_variant_change
AFTER INSERT OR UPDATE OR DELETE
ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_stock_from_variants();

-- =====================
-- SITE SETTINGS DEFAULTS
-- =====================
INSERT INTO public.site_settings (key, value)
VALUES
  ('site_name', 'E & S closet'),
  ('site_url', 'https://escloset.vestigh.com'),
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
```

## 4) RPC SQL (Required Functions)

Run these after the schema block.

### 4.1 `initialize_customer_profile`

```sql
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
```

### 4.2 `get_current_customer_role`

```sql
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
```
### 4.3 `submit_order`

```sql
CREATE OR REPLACE FUNCTION public.submit_order(
  p_customer_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_address_line1 TEXT,
  p_address_line2 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_country TEXT,
  p_delivery_instructions TEXT,
  p_save_address BOOLEAN,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_shipping_fee NUMERIC,
  p_discount_amount NUMERIC,
  p_total NUMERIC,
  p_notes TEXT,
  p_payment_method TEXT,
  p_mobile_money_number TEXT,
  p_marketing_opt_in BOOLEAN,
  p_ip_address TEXT
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  status public.order_status,
  total NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_shipping_address_id UUID;
  v_shipping_snapshot JSONB;
  v_order_id UUID;
  v_order_number TEXT;
  v_order_status public.order_status := 'pending';
  v_created_at TIMESTAMP WITH TIME ZONE;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_product_name TEXT;
  v_product_sku TEXT;
  v_product_image_url TEXT;
  v_unit_price NUMERIC(10,2);
  v_compare_at_price NUMERIC(10,2);
  v_has_variants BOOLEAN;
  v_variant_id UUID;
  v_variant_label VARCHAR(255);
  v_variant_sku VARCHAR(100);
  v_variant_price NUMERIC(10,2);
  v_variant_compare_at_price NUMERIC(10,2);
  v_updated_product_id UUID;
  v_updated_variant_id UUID;
  v_totals_already_incremented BOOLEAN := false;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EMPTY_CART';
  END IF;

  IF COALESCE(NULLIF(trim(p_email), ''), '') = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOMER_EMAIL_REQUIRED';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    INSERT INTO public.customers (
      id,
      first_name,
      last_name,
      email,
      phone,
      last_order_at,
      is_active,
      updated_at
    )
    VALUES (
      p_customer_id,
      COALESCE(NULLIF(trim(p_first_name), ''), 'Guest'),
      COALESCE(NULLIF(trim(p_last_name), ''), 'Customer'),
      lower(trim(p_email)),
      NULLIF(trim(p_phone), ''),
      now(),
      true,
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      first_name = COALESCE(NULLIF(trim(p_first_name), ''), customers.first_name),
      last_name = COALESCE(NULLIF(trim(p_last_name), ''), customers.last_name),
      email = lower(trim(p_email)),
      phone = COALESCE(NULLIF(trim(p_phone), ''), customers.phone),
      last_order_at = now()
    RETURNING id INTO v_customer_id;
  ELSE
    SELECT id
    INTO v_customer_id
    FROM public.customers
    WHERE email = lower(trim(p_email))
    LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
      UPDATE public.customers
      SET
        first_name = COALESCE(NULLIF(trim(p_first_name), ''), first_name),
        last_name = COALESCE(NULLIF(trim(p_last_name), ''), last_name),
        phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
        last_order_at = now(),
        total_orders = COALESCE(total_orders, 0) + 1,
        total_spent = COALESCE(total_spent, 0) + COALESCE(p_total, 0),
        updated_at = now()
      WHERE id = v_customer_id;

      v_totals_already_incremented := true;
    ELSE
      INSERT INTO public.customers (
        id,
        first_name,
        last_name,
        email,
        phone,
        total_orders,
        total_spent,
        last_order_at,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        COALESCE(NULLIF(trim(p_first_name), ''), 'Guest'),
        COALESCE(NULLIF(trim(p_last_name), ''), 'Customer'),
        lower(trim(p_email)),
        NULLIF(trim(p_phone), ''),
        1,
        COALESCE(p_total, 0),
        now(),
        true,
        now(),
        now()
      )
      RETURNING id INTO v_customer_id;

      INSERT INTO public.customer_roles (
        customer_id,
        role
      )
      VALUES (
        v_customer_id,
        'customer'
      )
      ON CONFLICT (customer_id) DO NOTHING;

      v_totals_already_incremented := true;
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOMER_UPSERT_FAILED';
  END IF;

  IF COALESCE(p_save_address, false) THEN
    INSERT INTO public.addresses (
      customer_id,
      label,
      recipient_name,
      recipient_phone,
      address_line1,
      address_line2,
      city,
      state,
      country,
      delivery_instructions
    )
    VALUES (
      v_customer_id,
      'Checkout Address',
      trim(concat_ws(' ', p_first_name, p_last_name)),
      NULLIF(trim(p_phone), ''),
      trim(p_address_line1),
      NULLIF(trim(p_address_line2), ''),
      trim(p_city),
      trim(p_state),
      COALESCE(NULLIF(trim(p_country), ''), 'Ghana'),
      NULLIF(trim(p_delivery_instructions), '')
    )
    RETURNING id INTO v_shipping_address_id;
  END IF;

  v_shipping_snapshot := jsonb_build_object(
    'recipient_name', trim(concat_ws(' ', p_first_name, p_last_name)),
    'recipient_phone', NULLIF(trim(p_phone), ''),
    'address_line1', trim(p_address_line1),
    'address_line2', NULLIF(trim(p_address_line2), ''),
    'city', trim(p_city),
    'state', trim(p_state),
    'country', COALESCE(NULLIF(trim(p_country), ''), 'Ghana'),
    'delivery_instructions', NULLIF(trim(p_delivery_instructions), '')
  );

  v_order_number := 'LUX-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('public.order_number_seq')::TEXT, 5, '0');

  INSERT INTO public.orders AS o (
    order_number,
    customer_id,
    shipping_address_id,
    shipping_address_snapshot,
    status,
    payment_status,
    payment_method,
    mobile_money_number,
    subtotal,
    shipping_fee,
    discount_amount,
    total,
    notes,
    ip_address
  )
  VALUES (
    v_order_number,
    v_customer_id,
    v_shipping_address_id,
    v_shipping_snapshot,
    v_order_status,
    'unpaid',
    NULLIF(trim(p_payment_method), ''),
    NULLIF(trim(p_mobile_money_number), ''),
    p_subtotal,
    p_shipping_fee,
    COALESCE(p_discount_amount, 0),
    p_total,
    NULLIF(trim(p_notes), ''),
    NULLIF(trim(p_ip_address), '')
  )
  RETURNING o.id, o.created_at INTO v_order_id, v_created_at;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS source(value)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_quantity := GREATEST(COALESCE((v_item->>'quantity')::INTEGER, 0), 0);

    IF v_product_id IS NULL OR v_quantity < 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_CART_ITEM';
    END IF;

    v_variant_label := NULL;
    v_variant_sku := NULL;
    v_variant_price := NULL;
    v_variant_compare_at_price := NULL;

    SELECT
      p.name,
      p.sku,
      p.price,
      p.compare_at_price,
      COALESCE(p.has_variants, false),
      COALESCE(
        (
          SELECT
            CASE
              WHEN jsonb_typeof(img) = 'string' THEN trim(both '"' FROM img::TEXT)
              ELSE COALESCE(img->>'url', img->>'image_url', img->>'src', '')
            END
          FROM jsonb_array_elements(COALESCE(p.images, '[]'::jsonb)) AS img
          ORDER BY CASE WHEN img->>'primary' = 'true' OR img->>'is_primary' = 'true' THEN 0 ELSE 1 END
          LIMIT 1
        ),
        ''
      )
    INTO
      v_product_name,
      v_product_sku,
      v_unit_price,
      v_compare_at_price,
      v_has_variants,
      v_product_image_url
    FROM public.products p
    WHERE p.id = v_product_id
      AND p.is_available = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCT_UNAVAILABLE';
    END IF;

    IF v_has_variants THEN
      IF v_variant_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VARIANT_REQUIRED';
      END IF;

      SELECT
        pv.id,
        pv.label,
        pv.sku,
        pv.price,
        pv.compare_at_price
      INTO
        v_variant_id,
        v_variant_label,
        v_variant_sku,
        v_variant_price,
        v_variant_compare_at_price
      FROM public.product_variants pv
      WHERE pv.id = v_variant_id
        AND pv.product_id = v_product_id
        AND pv.is_available = true
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VARIANT_UNAVAILABLE';
      END IF;

      v_unit_price := COALESCE(v_variant_price, v_unit_price);
      v_compare_at_price := COALESCE(v_variant_compare_at_price, v_compare_at_price);
      v_variant_sku := COALESCE(v_variant_sku, v_product_sku);

      UPDATE public.product_variants
      SET
        stock_quantity = stock_quantity - v_quantity,
        updated_at = now()
      WHERE id = v_variant_id
        AND stock_quantity >= v_quantity
      RETURNING id INTO v_updated_variant_id;

      IF v_updated_variant_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VARIANT_STOCK_CONFLICT';
      END IF;

      UPDATE public.products
      SET total_orders = COALESCE(total_orders, 0) + 1
      WHERE id = v_product_id;

      v_updated_variant_id := NULL;
    ELSE
      v_variant_id := NULL;

      UPDATE public.products
      SET
        stock_quantity = stock_quantity - v_quantity,
        total_orders = COALESCE(total_orders, 0) + 1
      WHERE id = v_product_id
        AND stock_quantity >= v_quantity
      RETURNING id INTO v_updated_product_id;

      IF v_updated_product_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STOCK_CONFLICT';
      END IF;

      v_updated_product_id := NULL;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      product_sku,
      product_image_url,
      unit_price,
      compare_at_price,
      quantity,
      subtotal,
      variant_id,
      variant_label,
      variant_sku
    )
    VALUES (
      v_order_id,
      v_product_id,
      v_product_name,
      v_product_sku,
      v_product_image_url,
      v_unit_price,
      v_compare_at_price,
      v_quantity,
      v_unit_price * v_quantity,
      v_variant_id,
      v_variant_label,
      v_variant_sku
    );
  END LOOP;

  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by,
    note
  )
  VALUES (
    v_order_id,
    NULL,
    'pending',
    'system',
    'Order placed successfully'
  );

  IF NOT v_totals_already_incremented THEN
    UPDATE public.customers
    SET
      total_orders = COALESCE(total_orders, 0) + 1,
      total_spent = COALESCE(total_spent, 0) + COALESCE(p_total, 0),
      last_order_at = now(),
      updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  order_id := v_order_id;
  order_number := v_order_number;
  status := v_order_status;
  total := p_total;
  created_at := v_created_at;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_order(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  JSONB,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_order(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  JSONB,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT
) TO anon, authenticated;
```

### 4.4 `get_order_confirmation_details`

```sql
CREATE OR REPLACE FUNCTION public.get_order_confirmation_details(p_order_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number TEXT := NULLIF(trim(p_order_number), '');
  v_payload JSONB;
BEGIN
  IF v_order_number IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'subtotal', o.subtotal,
    'shipping_fee', o.shipping_fee,
    'discount_amount', o.discount_amount,
    'total', o.total,
    'payment_method', o.payment_method,
    'mobile_money_number', o.mobile_money_number,
    'shipping_address_snapshot', o.shipping_address_snapshot,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'confirmation_email_sent', o.confirmation_email_sent,
    'customer', jsonb_build_object(
      'id', c.id,
      'first_name', c.first_name,
      'last_name', c.last_name,
      'email', c.email
    ),
    'order_items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'product_sku', oi.product_sku,
            'product_image_url', oi.product_image_url,
            'unit_price', oi.unit_price,
            'compare_at_price', oi.compare_at_price,
            'quantity', oi.quantity,
            'subtotal', oi.subtotal,
            'variant_id', oi.variant_id,
            'variant_label', oi.variant_label,
            'variant_sku', oi.variant_sku,
            'created_at', oi.created_at
          )
          ORDER BY oi.created_at ASC
        )
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      ),
      '[]'::jsonb
    ),
    'order_status_history', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'status', osh.new_status,
            'note', osh.note,
            'changed_at', osh.changed_at
          )
          ORDER BY osh.changed_at ASC
        )
        FROM public.order_status_history osh
        WHERE osh.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  INTO v_payload
  FROM public.orders o
  INNER JOIN public.customers c ON c.id = o.customer_id
  WHERE o.order_number = v_order_number
  LIMIT 1;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_confirmation_details(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_confirmation_details(TEXT) TO anon, authenticated;
```

### 4.5 `lookup_order_tracking_details`

```sql
CREATE OR REPLACE FUNCTION public.lookup_order_tracking_details(
  p_order_number TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number TEXT := NULLIF(trim(p_order_number), '');
  v_auth_uid UUID := auth.uid();
  v_customer_id UUID;
  v_customer_email TEXT;
  v_payload JSONB;
BEGIN
  IF v_order_number IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    o.customer_id,
    lower(c.email)
  INTO
    v_customer_id,
    v_customer_email
  FROM public.orders o
  INNER JOIN public.customers c ON c.id = o.customer_id
  WHERE o.order_number = v_order_number
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_auth_uid IS NULL THEN
    IF COALESCE(NULLIF(trim(p_email), ''), '') = '' THEN
      RETURN NULL;
    END IF;

    IF lower(trim(p_email)) <> v_customer_email THEN
      RETURN NULL;
    END IF;
  ELSIF v_customer_id <> v_auth_uid THEN
    RETURN NULL;
  END IF;

  v_payload := public.get_order_confirmation_details(v_order_number);
  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_order_tracking_details(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_order_tracking_details(TEXT, TEXT) TO anon, authenticated;
```
### 4.6 `assign_customer_role`

```sql
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
```

### 4.7 `log_admin_activity`

```sql
CREATE OR REPLACE FUNCTION public.log_admin_activity(
  p_action TEXT,
  p_target_table TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'NOT_ALLOWED';
  END IF;

  INSERT INTO public.admin_activity_log (
    admin_id,
    action,
    target_table,
    target_id,
    metadata
  )
  VALUES (
    auth.uid(),
    p_action,
    p_target_table,
    p_target_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_activity(TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_activity(TEXT, TEXT, UUID, JSONB) TO authenticated;
```

## 5) RLS Policies (All Project Tables)

Run after schema + RPC creation.

```sql
-- Enable RLS on all relevant tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Categories
DROP POLICY IF EXISTS "Categories are publicly readable" ON public.categories;
CREATE POLICY "Categories are publicly readable"
ON public.categories
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "admin manage categories" ON public.categories;
CREATE POLICY "admin manage categories"
ON public.categories
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

-- Products
DROP POLICY IF EXISTS "Products are publicly readable" ON public.products;
CREATE POLICY "Products are publicly readable"
ON public.products
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "admin manage products" ON public.products;
CREATE POLICY "admin manage products"
ON public.products
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

-- Product option types
DROP POLICY IF EXISTS "public read option types" ON public.product_option_types;
CREATE POLICY "public read option types"
ON public.product_option_types
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "admin manage option types" ON public.product_option_types;
CREATE POLICY "admin manage option types"
ON public.product_option_types
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- Product option values
DROP POLICY IF EXISTS "public read option values" ON public.product_option_values;
CREATE POLICY "public read option values"
ON public.product_option_values
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "admin manage option values" ON public.product_option_values;
CREATE POLICY "admin manage option values"
ON public.product_option_values
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- Product variants
DROP POLICY IF EXISTS "public read variants" ON public.product_variants;
CREATE POLICY "public read variants"
ON public.product_variants
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "admin manage variants" ON public.product_variants;
CREATE POLICY "admin manage variants"
ON public.product_variants
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- Product variant options
DROP POLICY IF EXISTS "public read variant options" ON public.product_variant_options;
CREATE POLICY "public read variant options"
ON public.product_variant_options
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "admin manage variant options" ON public.product_variant_options;
CREATE POLICY "admin manage variant options"
ON public.product_variant_options
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- Shipping rates
DROP POLICY IF EXISTS "Shipping rates are publicly readable" ON public.shipping_rates;
CREATE POLICY "Shipping rates are publicly readable"
ON public.shipping_rates
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "admin manage shipping" ON public.shipping_rates;
CREATE POLICY "admin manage shipping"
ON public.shipping_rates
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- Discount codes
DROP POLICY IF EXISTS "Active discount codes are publicly readable" ON public.discount_codes;
CREATE POLICY "Active discount codes are publicly readable"
ON public.discount_codes
FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "admin manage discounts" ON public.discount_codes;
CREATE POLICY "admin manage discounts"
ON public.discount_codes
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- Customers
DROP POLICY IF EXISTS "Customers can read own profile" ON public.customers;
CREATE POLICY "Customers can read own profile"
ON public.customers
FOR SELECT
USING (id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;
CREATE POLICY "Customers can update own profile"
ON public.customers
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "admin read customers" ON public.customers;
CREATE POLICY "admin read customers"
ON public.customers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin','super_admin')
  )
);

DROP POLICY IF EXISTS "admin update customers" ON public.customers;
CREATE POLICY "admin update customers"
ON public.customers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin','super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin','super_admin')
  )
);

-- Addresses
DROP POLICY IF EXISTS "Customers can read own addresses" ON public.addresses;
CREATE POLICY "Customers can read own addresses"
ON public.addresses
FOR SELECT
USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert own addresses" ON public.addresses;
CREATE POLICY "Customers can insert own addresses"
ON public.addresses
FOR INSERT
WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own addresses" ON public.addresses;
CREATE POLICY "Customers can update own addresses"
ON public.addresses
FOR UPDATE
USING (customer_id = auth.uid())
WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete own addresses" ON public.addresses;
CREATE POLICY "Customers can delete own addresses"
ON public.addresses
FOR DELETE
USING (customer_id = auth.uid());

-- Orders
DROP POLICY IF EXISTS "Customers can read own orders" ON public.orders;
CREATE POLICY "Customers can read own orders"
ON public.orders
FOR SELECT
USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "admin manage orders" ON public.orders;
CREATE POLICY "admin manage orders"
ON public.orders
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

-- Order items
DROP POLICY IF EXISTS "Customers can read own order items" ON public.order_items;
CREATE POLICY "Customers can read own order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "admin manage order items" ON public.order_items;
CREATE POLICY "admin manage order items"
ON public.order_items
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

-- Order status history
DROP POLICY IF EXISTS "Customers can read own order status history" ON public.order_status_history;
CREATE POLICY "Customers can read own order status history"
ON public.order_status_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_status_history.order_id
      AND orders.customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "admin manage order status history" ON public.order_status_history;
CREATE POLICY "admin manage order status history"
ON public.order_status_history
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

-- Customer roles
DROP POLICY IF EXISTS "super_admin manage roles" ON public.customer_roles;
CREATE POLICY "super_admin manage roles"
ON public.customer_roles
FOR ALL
USING (public.current_user_is_super_admin())
WITH CHECK (public.current_user_is_super_admin());

-- Admin notifications
DROP POLICY IF EXISTS "admin read notifications" ON public.admin_notifications;
CREATE POLICY "admin read notifications"
ON public.admin_notifications
FOR SELECT
USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "admin update notifications" ON public.admin_notifications;
CREATE POLICY "admin update notifications"
ON public.admin_notifications
FOR UPDATE
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

-- Admin activity log
DROP POLICY IF EXISTS "admin read activity" ON public.admin_activity_log;
CREATE POLICY "admin read activity"
ON public.admin_activity_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_roles
    WHERE customer_id = auth.uid()
      AND role IN ('admin','super_admin')
  )
);

-- Site settings
DROP POLICY IF EXISTS "super_admin settings" ON public.site_settings;
CREATE POLICY "super_admin settings"
ON public.site_settings
FOR ALL
USING (public.current_user_is_super_admin())
WITH CHECK (public.current_user_is_super_admin());
```

## 6) Storage Buckets and Storage Policies

Bucket visibility in current project schema:

- `avatars`: public
- `tryon-uploads`: public
- `product-images`: public
- `category-images`: public

Run:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'tryon-uploads',
    'tryon-uploads',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png']
  ),
  (
    'product-images',
    'product-images',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'category-images',
    'category-images',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Avatars
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Product images
DROP POLICY IF EXISTS "Public can read product images" ON storage.objects;
CREATE POLICY "Public can read product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins manage product images" ON storage.objects;
CREATE POLICY "Admins manage product images"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.current_user_is_admin()
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.current_user_is_admin()
);

-- Category images
DROP POLICY IF EXISTS "Public can read category images" ON storage.objects;
CREATE POLICY "Public can read category images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'category-images');

DROP POLICY IF EXISTS "Admins manage category images" ON storage.objects;
CREATE POLICY "Admins manage category images"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'category-images'
  AND public.current_user_is_admin()
)
WITH CHECK (
  bucket_id = 'category-images'
  AND public.current_user_is_admin()
);

-- Try-on uploads
DROP POLICY IF EXISTS "public tryon uploads" ON storage.objects;
CREATE POLICY "public tryon uploads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'tryon-uploads');

DROP POLICY IF EXISTS "public tryon reads" ON storage.objects;
CREATE POLICY "public tryon reads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'tryon-uploads');
```
## 7) Edge Functions to Deploy

Deploy these functions for every client project:

1. `send_welcome_email`
2. `send_order_confirmation_email`
3. `send_new_order_admin_notification`
4. `send_order_status_update_email`
5. `ai_product_autofill`

CLI example:

```bash
supabase functions deploy send_welcome_email --project-ref <PROJECT_REF>
supabase functions deploy send_order_confirmation_email --project-ref <PROJECT_REF>
supabase functions deploy send_new_order_admin_notification --project-ref <PROJECT_REF>
supabase functions deploy send_order_status_update_email --project-ref <PROJECT_REF>
supabase functions deploy ai_product_autofill --project-ref <PROJECT_REF>
```

## 8) Edge Function Secrets (Dashboard)

Required secrets to add (per your deployment model):

- `RESEND_API_KEY`
- `STYLESYNC_API_KEY`

Add them in Supabase Dashboard:

- Project Settings > Edge Functions > Secrets > Add secret

CLI example:

```bash
supabase secrets set RESEND_API_KEY=<value> STYLESYNC_API_KEY=<value> --project-ref <PROJECT_REF>
```

Important compatibility note for current codebase:

- Current `ai_product_autofill` implementation reads `GEMINI_API_KEY`.
- If you keep this implementation as-is, also set:

```bash
supabase secrets set GEMINI_API_KEY=<value> --project-ref <PROJECT_REF>
```

Other useful optional secrets used by edge functions (with defaults if omitted):

- `SITE_URL`
- `ORDER_CONFIRMATION_FROM_EMAIL`
- `SUPPORT_EMAIL`
- `INSTAGRAM_URL`
- `TIKTOK_URL`
- `FACEBOOK_URL`
- `UNSUBSCRIBE_URL`

## 9) Optional Google OAuth Setup

Use this only if client wants Google sign-in.

1. In Google Cloud Console:
   - Configure OAuth consent screen.
   - Create OAuth 2.0 Client ID (Web application).
   - Add Authorized redirect URI:
     - `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
2. In Supabase Dashboard:
   - Authentication > Providers > Google
   - Enable Google provider
   - Paste Google Client ID + Client Secret
3. In Supabase Dashboard > Authentication > URL Configuration:
   - Set Site URL to your production storefront domain
   - Add Additional Redirect URLs including:
     - `https://<your-store-domain>/auth/login`
     - `http://localhost:5173/auth/login` (local dev)

This matches the app's `signInWithOAuth` redirect behavior in `src/services/authService.ts`.

## 10) Create the First `super_admin` User

Because `assign_customer_role` is protected by `current_user_is_super_admin()`, bootstrap the first super admin directly in SQL.

1. Have the intended owner create an account (email/password or Google).
2. Get their auth user id:

```sql
SELECT id, email
FROM auth.users
WHERE email = 'owner@client.com';
```

3. Ensure customer profile row exists and is linked to same UUID:

```sql
SELECT public.initialize_customer_profile(
  '<USER_ID>'::uuid,
  'OwnerFirstName',
  'OwnerLastName',
  'owner@client.com'
);
```

4. Bootstrap role:

```sql
INSERT INTO public.customer_roles (
  customer_id,
  role,
  assigned_by,
  assigned_at,
  updated_at
)
VALUES (
  '<USER_ID>'::uuid,
  'super_admin',
  NULL,
  now(),
  now()
)
ON CONFLICT (customer_id) DO UPDATE
SET
  role = EXCLUDED.role,
  assigned_by = EXCLUDED.assigned_by,
  assigned_at = EXCLUDED.assigned_at,
  updated_at = now();
```

5. Verify:

```sql
SELECT customer_id, role, assigned_at
FROM public.customer_roles
WHERE customer_id = '<USER_ID>'::uuid;
```

After this, role management can happen through `assign_customer_role` RPC or admin UI workflows.

## 11) Quick New-Client Runbook (Under 1 Hour)

1. Create Supabase project.
2. Set frontend `.env` values from `.env.example`.
3. Run SQL sections 3, 4, 5, and 6 in order.
4. Deploy all five edge functions.
5. Add edge secrets (`RESEND_API_KEY`, `STYLESYNC_API_KEY`, plus `GEMINI_API_KEY` if current autofill stays unchanged).
6. (Optional) configure Google OAuth.
7. Create first `super_admin`.
8. Smoke test:
   - register/login
   - product read
   - checkout/submit order
   - order confirmation/tracking
   - admin notifications

