CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    NEW.order_number := 'LUX-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('public.order_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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
  v_updated_product_id UUID;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EMPTY_CART';
  END IF;

  IF COALESCE(NULLIF(trim(p_email), ''), '') = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOMER_EMAIL_REQUIRED';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET
      first_name = COALESCE(NULLIF(trim(p_first_name), ''), first_name),
      last_name = COALESCE(NULLIF(trim(p_last_name), ''), last_name),
      phone = NULLIF(trim(p_phone), ''),
      last_order_at = now(),
      updated_at = now()
    WHERE id = p_customer_id
    RETURNING id INTO v_customer_id;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      first_name,
      last_name,
      email,
      phone,
      last_order_at
    )
    VALUES (
      COALESCE(NULLIF(trim(p_first_name), ''), 'Guest'),
      COALESCE(NULLIF(trim(p_last_name), ''), 'Customer'),
      lower(trim(p_email)),
      NULLIF(trim(p_phone), ''),
      now()
    )
    ON CONFLICT (email) DO UPDATE
    SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone = EXCLUDED.phone,
      last_order_at = now()
    RETURNING id INTO v_customer_id;
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
      COALESCE(NULLIF(trim(p_country), ''), 'Nigeria'),
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
    'country', COALESCE(NULLIF(trim(p_country), ''), 'Nigeria'),
    'delivery_instructions', NULLIF(trim(p_delivery_instructions), '')
  );

  v_order_number := 'LUX-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('public.order_number_seq')::TEXT, 5, '0');

  INSERT INTO public.orders (
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
  RETURNING id, created_at INTO v_order_id, v_created_at;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS source(value)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    v_quantity := GREATEST(COALESCE((v_item->>'quantity')::INTEGER, 0), 0);

    IF v_product_id IS NULL OR v_quantity < 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_CART_ITEM';
    END IF;

    SELECT
      p.name,
      p.sku,
      p.price,
      p.compare_at_price,
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
      v_product_image_url
    FROM public.products p
    WHERE p.id = v_product_id
      AND p.is_available = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCT_UNAVAILABLE';
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
      subtotal
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
      v_unit_price * v_quantity
    );

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

  UPDATE public.customers
  SET
    total_orders = COALESCE(total_orders, 0) + 1,
    total_spent = COALESCE(total_spent, 0) + COALESCE(p_total, 0),
    last_order_at = now(),
    updated_at = now()
  WHERE id = v_customer_id;

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

DROP POLICY IF EXISTS "Allow anonymous order creation" ON public.customers;
DROP POLICY IF EXISTS "Allow anonymous address creation" ON public.addresses;
DROP POLICY IF EXISTS "Allow anonymous order insert" ON public.orders;
DROP POLICY IF EXISTS "Allow anonymous order items insert" ON public.order_items;
DROP POLICY IF EXISTS "Allow anonymous order status history insert" ON public.order_status_history;
DROP POLICY IF EXISTS "Orders readable by order number" ON public.orders;
DROP POLICY IF EXISTS "Order items readable" ON public.order_items;
DROP POLICY IF EXISTS "Order status history readable" ON public.order_status_history;

DROP POLICY IF EXISTS "Customers can read own orders" ON public.orders;
CREATE POLICY "Customers can read own orders"
ON public.orders
FOR SELECT
USING (customer_id = auth.uid());

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

DROP POLICY IF EXISTS "Products admin insert" ON public.products;
DROP POLICY IF EXISTS "Products admin update" ON public.products;
DROP POLICY IF EXISTS "Products admin delete" ON public.products;

CREATE POLICY "Products admin insert"
ON public.products
FOR INSERT
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Products admin update"
ON public.products
FOR UPDATE
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Products admin delete"
ON public.products
FOR DELETE
USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "Customers can read own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;

CREATE POLICY "Customers can read own profile"
ON public.customers
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Customers can update own profile"
ON public.customers
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DO $$
BEGIN
  IF to_regclass('public.customer_roles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.customer_roles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Customers can read own role" ON public.customer_roles';
    EXECUTE 'CREATE POLICY "Customers can read own role" ON public.customer_roles FOR SELECT USING (customer_id = auth.uid())';
  END IF;
END;
$$;
