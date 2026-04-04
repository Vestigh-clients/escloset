CREATE OR REPLACE FUNCTION public.get_order_number_prefix()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
BEGIN
  IF to_regclass('public.site_settings') IS NULL THEN
    RETURN 'LUX';
  END IF;

  SELECT value
  INTO v_prefix
  FROM public.site_settings
  WHERE key = 'order_number_prefix'
  LIMIT 1;

  v_prefix := upper(regexp_replace(COALESCE(trim(v_prefix), ''), '[^A-Z0-9]', '', 'g'));

  IF v_prefix = '' THEN
    v_prefix := 'LUX';
  END IF;

  RETURN left(v_prefix, 5);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    NEW.order_number :=
      public.get_order_number_prefix() || '-' ||
      EXTRACT(YEAR FROM now())::TEXT || '-' ||
      LPAD(nextval('public.order_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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
  TEXT,
  TEXT,
  TEXT
) TO anon, authenticated;
