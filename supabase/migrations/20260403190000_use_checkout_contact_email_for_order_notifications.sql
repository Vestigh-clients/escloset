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
  p_ip_address TEXT,
  p_status TEXT,
  p_payment_status TEXT
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
  v_requested_status TEXT := lower(COALESCE(trim(p_status), 'pending'));
  v_requested_payment_status TEXT := lower(COALESCE(trim(p_payment_status), 'pending'));
  v_created_order RECORD;
  v_order_prefix TEXT;
  v_order_suffix TEXT;
  v_resolved_order_number TEXT;
BEGIN
  IF v_requested_status = '' THEN
    v_requested_status := 'pending';
  END IF;

  IF v_requested_payment_status = '' THEN
    v_requested_payment_status := 'pending';
  END IF;

  IF v_requested_status NOT IN (
    'pending_payment',
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_ORDER_STATUS';
  END IF;

  IF v_requested_payment_status NOT IN ('pending', 'paid', 'failed', 'review') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_PAYMENT_STATUS';
  END IF;

  SELECT *
  INTO v_created_order
  FROM public.submit_order(
    p_customer_id,
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_address_line1,
    p_address_line2,
    p_city,
    p_state,
    p_country,
    p_delivery_instructions,
    p_save_address,
    p_items,
    p_subtotal,
    p_shipping_fee,
    p_discount_amount,
    p_total,
    p_notes,
    p_payment_method,
    p_mobile_money_number,
    p_marketing_opt_in,
    p_ip_address
  )
  LIMIT 1;

  IF v_created_order.order_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ORDER_CREATE_FAILED';
  END IF;

  UPDATE public.orders
  SET
    status = v_requested_status::public.order_status,
    payment_status = v_requested_payment_status,
    shipping_address_snapshot = jsonb_set(
      COALESCE(shipping_address_snapshot, '{}'::jsonb),
      '{email}',
      to_jsonb(lower(trim(p_email))),
      true
    ),
    updated_at = now()
  WHERE id = v_created_order.order_id;

  IF v_created_order.status::TEXT <> v_requested_status THEN
    INSERT INTO public.order_status_history (
      order_id,
      previous_status,
      new_status,
      changed_by,
      note,
      notified_customer
    )
    VALUES (
      v_created_order.order_id,
      v_created_order.status,
      v_requested_status::public.order_status,
      'system',
      CASE
        WHEN v_requested_status = 'pending_payment' THEN 'Awaiting online payment confirmation'
        WHEN v_requested_status = 'confirmed' THEN 'Order confirmed at checkout'
        ELSE format('Order status set to %s during checkout', v_requested_status)
      END,
      false
    );
  END IF;

  v_order_prefix := public.get_order_number_prefix();
  v_order_suffix := regexp_replace(COALESCE(v_created_order.order_number, ''), '^[^-]+-', '');

  IF v_order_suffix = '' OR v_order_suffix = COALESCE(v_created_order.order_number, '') THEN
    v_order_suffix := to_char(now(), 'YYYY') || '-' || LPAD(nextval('public.order_number_seq')::TEXT, 5, '0');
  END IF;

  v_resolved_order_number := v_order_prefix || '-' || v_order_suffix;

  IF v_resolved_order_number <> COALESCE(v_created_order.order_number, '') THEN
    BEGIN
      UPDATE public.orders
      SET
        order_number = v_resolved_order_number,
        updated_at = now()
      WHERE id = v_created_order.order_id;
    EXCEPTION
      WHEN unique_violation THEN
        v_resolved_order_number := v_created_order.order_number;
    END;
  END IF;

  order_id := v_created_order.order_id;
  order_number := v_resolved_order_number;
  status := v_requested_status::public.order_status;
  total := v_created_order.total;
  created_at := v_created_order.created_at;
  RETURN NEXT;
END;
$$;

UPDATE public.orders o
SET shipping_address_snapshot = jsonb_set(
  COALESCE(o.shipping_address_snapshot, '{}'::jsonb),
  '{email}',
  to_jsonb(lower(trim(c.email))),
  true
)
FROM public.customers c
WHERE c.id = o.customer_id
  AND (
    COALESCE(NULLIF(trim(COALESCE(
      o.shipping_address_snapshot ->> 'email',
      o.shipping_address_snapshot ->> 'contact_email',
      o.shipping_address_snapshot ->> 'recipient_email'
    )), ''), '') = ''
  );

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
    'contact_email', COALESCE(
      NULLIF(lower(trim(COALESCE(
        o.shipping_address_snapshot ->> 'email',
        o.shipping_address_snapshot ->> 'contact_email',
        o.shipping_address_snapshot ->> 'recipient_email'
      ))), ''),
      lower(c.email)
    ),
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
  v_contact_email TEXT;
  v_payload JSONB;
BEGIN
  IF v_order_number IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    o.customer_id,
    COALESCE(
      NULLIF(lower(trim(COALESCE(
        o.shipping_address_snapshot ->> 'email',
        o.shipping_address_snapshot ->> 'contact_email',
        o.shipping_address_snapshot ->> 'recipient_email'
      ))), ''),
      lower(c.email)
    )
  INTO
    v_customer_id,
    v_contact_email
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

    IF lower(trim(p_email)) IS DISTINCT FROM v_contact_email THEN
      RETURN NULL;
    END IF;
  ELSIF v_customer_id <> v_auth_uid THEN
    RETURN NULL;
  END IF;

  v_payload := public.get_order_confirmation_details(v_order_number);
  RETURN v_payload;
END;
$$;
