-- ============================================
-- Dynamic Variant System
-- ============================================

-- Drop old relationships and structures
ALTER TABLE IF EXISTS public.order_items
  DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;

DROP VIEW IF EXISTS public.products_with_stock;

DROP TABLE IF EXISTS public.product_variant_options CASCADE;
DROP TABLE IF EXISTS public.product_option_values CASCADE;
DROP TABLE IF EXISTS public.product_option_types CASCADE;
DROP TABLE IF EXISTS public.product_variants CASCADE;

-- Dynamic option types per product
CREATE TABLE public.product_option_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Values for each option type
CREATE TABLE public.product_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type_id UUID NOT NULL REFERENCES public.product_option_types(id) ON DELETE CASCADE,
  value VARCHAR(100) NOT NULL,
  color_hex VARCHAR(7),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Variant rows (combination outcomes)
CREATE TABLE public.product_variants (
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

-- Links a variant to chosen option values
CREATE TABLE public.product_variant_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  option_type_id UUID NOT NULL REFERENCES public.product_option_types(id) ON DELETE CASCADE,
  option_value_id UUID NOT NULL REFERENCES public.product_option_values(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_product_option_types_product_id ON public.product_option_types(product_id);
CREATE INDEX idx_product_option_values_option_type_id ON public.product_option_values(option_type_id);
CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON public.product_variants(sku);
CREATE INDEX idx_product_variants_available ON public.product_variants(is_available);
CREATE INDEX idx_product_variants_display ON public.product_variants(product_id, display_order);
CREATE INDEX idx_product_variant_options_variant_id ON public.product_variant_options(variant_id);
CREATE INDEX idx_product_variant_options_option_value_id ON public.product_variant_options(option_value_id);

-- Uniqueness
ALTER TABLE public.product_option_types
  ADD CONSTRAINT unique_option_type UNIQUE (product_id, name);

ALTER TABLE public.product_option_values
  ADD CONSTRAINT unique_option_value UNIQUE (option_type_id, value);

ALTER TABLE public.product_variant_options
  ADD CONSTRAINT unique_variant_option UNIQUE (variant_id, option_type_id);

-- updated_at trigger for product_variants
DROP TRIGGER IF EXISTS update_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure products has has_variants flag
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false;

-- Update order item snapshots
ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS variant_size,
  DROP COLUMN IF EXISTS variant_color,
  DROP COLUMN IF EXISTS variant_color_hex;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID,
  ADD COLUMN IF NOT EXISTS variant_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS variant_sku VARCHAR(100);

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
  ON DELETE SET NULL;

-- Stock-aware product helper view
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
      p.is_available
      AND EXISTS (
        SELECT 1
        FROM public.product_variants pv
        WHERE pv.product_id = p.id
          AND pv.is_available = true
          AND pv.stock_quantity > 0
      )
    )
    ELSE (p.stock_quantity > 0 AND p.is_available)
  END AS in_stock
FROM public.products p;

-- Variant-aware submit_order RPC using variant label snapshots
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

-- Update order confirmation payload snapshots
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

-- RLS
ALTER TABLE public.product_option_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read option types" ON public.product_option_types;
CREATE POLICY "public read option types"
ON public.product_option_types
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "public read option values" ON public.product_option_values;
CREATE POLICY "public read option values"
ON public.product_option_values
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "public read variants" ON public.product_variants;
CREATE POLICY "public read variants"
ON public.product_variants
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "public read variant options" ON public.product_variant_options;
CREATE POLICY "public read variant options"
ON public.product_variant_options
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
