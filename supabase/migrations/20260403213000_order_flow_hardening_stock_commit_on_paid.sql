ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS stock_committed BOOLEAN NOT NULL DEFAULT false;

UPDATE public.orders
SET stock_committed = true
WHERE stock_committed = false
  AND (
    payment_status = 'paid'
    OR status IN ('confirmed', 'processing', 'shipped', 'delivered')
  );

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
  v_checkout_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_inner_email TEXT;
  v_customer_email TEXT;
  v_created_order RECORD;
  v_order_prefix TEXT;
  v_order_suffix TEXT;
  v_resolved_order_number TEXT;
  v_item RECORD;
  v_should_commit_stock BOOLEAN := false;
  v_stock_note TEXT;
  v_updated_rows INTEGER;
BEGIN
  IF v_requested_status = '' THEN
    v_requested_status := 'pending';
  END IF;

  IF v_requested_payment_status = '' THEN
    v_requested_payment_status := 'pending';
  END IF;

  IF v_checkout_email = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOMER_EMAIL_REQUIRED';
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

  v_inner_email := v_checkout_email;

  IF p_customer_id IS NOT NULL THEN
    SELECT lower(trim(c.email))
    INTO v_customer_email
    FROM public.customers c
    WHERE c.id = p_customer_id
    LIMIT 1;

    IF COALESCE(v_customer_email, '') <> '' THEN
      -- Preserve the account email; checkout email is stored on the order snapshot.
      v_inner_email := v_customer_email;
    END IF;
  END IF;

  SELECT *
  INTO v_created_order
  FROM public.submit_order(
    p_customer_id,
    p_first_name,
    p_last_name,
    v_inner_email,
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

  v_should_commit_stock := v_requested_payment_status = 'paid';

  IF NOT v_should_commit_stock THEN
    -- Base submit_order decrements stock. Restore immediately so stock is committed only after payment is paid.
    FOR v_item IN
      SELECT
        oi.product_id,
        oi.variant_id,
        GREATEST(COALESCE(oi.quantity, 0), 0) AS quantity
      FROM public.order_items oi
      WHERE oi.order_id = v_created_order.order_id
    LOOP
      IF v_item.quantity < 1 THEN
        CONTINUE;
      END IF;

      IF v_item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET
          stock_quantity = stock_quantity + v_item.quantity,
          updated_at = now()
        WHERE id = v_item.variant_id;

        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

        IF v_updated_rows = 0 THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STOCK_RESTORE_FAILED';
        END IF;
      ELSE
        UPDATE public.products
        SET
          stock_quantity = stock_quantity + v_item.quantity,
          updated_at = now()
        WHERE id = v_item.product_id;

        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

        IF v_updated_rows = 0 THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STOCK_RESTORE_FAILED';
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET
    status = v_requested_status::public.order_status,
    payment_status = v_requested_payment_status,
    stock_committed = v_should_commit_stock,
    shipping_address_snapshot = jsonb_set(
      jsonb_set(
        COALESCE(shipping_address_snapshot, '{}'::jsonb),
        '{email}',
        to_jsonb(v_checkout_email),
        true
      ),
      '{contact_email}',
      to_jsonb(v_checkout_email),
      true
    ),
    updated_at = now()
  WHERE id = v_created_order.order_id;

  IF v_created_order.status::TEXT <> v_requested_status THEN
    v_stock_note := CASE
      WHEN v_requested_status = 'pending_payment' THEN 'Awaiting online payment confirmation'
      WHEN v_requested_status = 'confirmed' AND NOT v_should_commit_stock THEN 'Order confirmed; stock will be committed after payment confirmation'
      WHEN v_requested_status = 'confirmed' THEN 'Order confirmed at checkout'
      ELSE format('Order status set to %s during checkout', v_requested_status)
    END;

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
      v_stock_note,
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

CREATE OR REPLACE FUNCTION public.confirm_paid_order_and_commit_stock(
  p_order_number TEXT,
  p_payment_reference TEXT DEFAULT NULL,
  p_amount_paid NUMERIC DEFAULT NULL,
  p_changed_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number TEXT := NULLIF(trim(p_order_number), '');
  v_payment_reference TEXT := NULLIF(trim(COALESCE(p_payment_reference, '')), '');
  v_changed_by TEXT := COALESCE(NULLIF(trim(COALESCE(p_changed_by, '')), ''), 'system');
  v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_order RECORD;
  v_item RECORD;
  v_updated_variant_id UUID;
  v_updated_product_id UUID;
  v_stock_error TEXT;
  v_mismatch_note TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_jwt_role <> 'service_role' AND NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;

  IF v_order_number IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'order_number_required'
    );
  END IF;

  SELECT
    o.id,
    o.order_number,
    o.total,
    o.status,
    o.payment_status,
    o.stock_committed,
    o.notes,
    o.paystack_reference,
    o.payment_reference,
    o.paid_at
  INTO v_order
  FROM public.orders o
  WHERE o.order_number = v_order_number
  LIMIT 1
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'not_found'
    );
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'order_cancelled'
    );
  END IF;

  IF v_order.payment_status = 'paid' AND COALESCE(v_order.stock_committed, false) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'order_id', v_order.id,
      'order_number', v_order.order_number
    );
  END IF;

  IF p_amount_paid IS NOT NULL AND abs(COALESCE(v_order.total, 0) - p_amount_paid) > 1 THEN
    v_mismatch_note := format('Amount mismatch: expected %s, received %s', v_order.total, p_amount_paid);

    UPDATE public.orders
    SET
      payment_status = 'review',
      notes = CASE
        WHEN COALESCE(NULLIF(trim(COALESCE(notes, '')), ''), '') = '' THEN v_mismatch_note
        ELSE trim(notes) || E'\n' || v_mismatch_note
      END,
      updated_at = v_now
    WHERE id = v_order.id;

    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'amount_mismatch'
    );
  END IF;

  IF NOT COALESCE(v_order.stock_committed, false) THEN
    BEGIN
      FOR v_item IN
        SELECT
          oi.product_id,
          oi.variant_id,
          GREATEST(COALESCE(oi.quantity, 0), 0) AS quantity
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id
      LOOP
        IF v_item.quantity < 1 THEN
          CONTINUE;
        END IF;

        IF v_item.variant_id IS NOT NULL THEN
          UPDATE public.product_variants
          SET
            stock_quantity = stock_quantity - v_item.quantity,
            updated_at = v_now
          WHERE id = v_item.variant_id
            AND stock_quantity >= v_item.quantity
          RETURNING id INTO v_updated_variant_id;

          IF v_updated_variant_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VARIANT_STOCK_CONFLICT';
          END IF;
        ELSE
          UPDATE public.products
          SET
            stock_quantity = stock_quantity - v_item.quantity,
            updated_at = v_now
          WHERE id = v_item.product_id
            AND stock_quantity >= v_item.quantity
          RETURNING id INTO v_updated_product_id;

          IF v_updated_product_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STOCK_CONFLICT';
          END IF;
        END IF;
      END LOOP;
    EXCEPTION
      WHEN OTHERS THEN
        v_stock_error := SQLERRM;
    END;

    IF v_stock_error IS NOT NULL THEN
      UPDATE public.orders
      SET
        payment_status = 'review',
        notes = CASE
          WHEN COALESCE(NULLIF(trim(COALESCE(notes, '')), ''), '') = '' THEN 'Stock conflict while confirming payment. Please review inventory.'
          ELSE trim(notes) || E'\n' || 'Stock conflict while confirming payment. Please review inventory.'
        END,
        updated_at = v_now
      WHERE id = v_order.id;

      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'stock_conflict',
        'message', v_stock_error
      );
    END IF;
  END IF;

  UPDATE public.orders
  SET
    status = 'confirmed',
    payment_status = 'paid',
    stock_committed = true,
    paystack_reference = COALESCE(v_payment_reference, paystack_reference),
    payment_reference = COALESCE(v_payment_reference, payment_reference),
    paid_at = COALESCE(paid_at, v_now),
    updated_at = v_now
  WHERE id = v_order.id;

  IF v_order.status IS DISTINCT FROM 'confirmed' THEN
    INSERT INTO public.order_status_history (
      order_id,
      previous_status,
      new_status,
      changed_by,
      note,
      notified_customer
    )
    VALUES (
      v_order.id,
      v_order.status,
      'confirmed',
      v_changed_by,
      'Payment confirmed',
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', 'confirmed',
    'payment_status', 'paid'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order_and_restore_stock(
  p_order_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_changed_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_reason TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_changed_by TEXT := COALESCE(NULLIF(trim(COALESCE(p_changed_by, '')), ''), 'admin_panel');
  v_order RECORD;
  v_item RECORD;
  v_history_id UUID;
  v_now TIMESTAMPTZ := now();
  v_updated_rows INTEGER;
BEGIN
  IF v_jwt_role <> 'service_role' AND NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;

  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'order_id_required'
    );
  END IF;

  SELECT
    o.id,
    o.order_number,
    o.status,
    o.stock_committed
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  LIMIT 1
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'not_found'
    );
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_cancelled', true,
      'order_id', v_order.id,
      'order_number', v_order.order_number
    );
  END IF;

  IF COALESCE(v_order.stock_committed, false) THEN
    FOR v_item IN
      SELECT
        oi.product_id,
        oi.variant_id,
        GREATEST(COALESCE(oi.quantity, 0), 0) AS quantity
      FROM public.order_items oi
      WHERE oi.order_id = v_order.id
    LOOP
      IF v_item.quantity < 1 THEN
        CONTINUE;
      END IF;

      IF v_item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET
          stock_quantity = stock_quantity + v_item.quantity,
          updated_at = v_now
        WHERE id = v_item.variant_id;

        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

        IF v_updated_rows = 0 THEN
          UPDATE public.products
          SET
            stock_quantity = stock_quantity + v_item.quantity,
            updated_at = v_now
          WHERE id = v_item.product_id;

          GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

          IF v_updated_rows = 0 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STOCK_RESTORE_FAILED';
          END IF;
        END IF;
      ELSE
        UPDATE public.products
        SET
          stock_quantity = stock_quantity + v_item.quantity,
          updated_at = v_now
        WHERE id = v_item.product_id;

        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

        IF v_updated_rows = 0 THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STOCK_RESTORE_FAILED';
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET
    status = 'cancelled',
    cancelled_at = COALESCE(cancelled_at, v_now),
    cancel_reason = COALESCE(v_reason, cancel_reason),
    stock_committed = false,
    updated_at = v_now
  WHERE id = v_order.id;

  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by,
    note,
    notified_customer
  )
  VALUES (
    v_order.id,
    v_order.status,
    'cancelled',
    v_changed_by,
    v_reason,
    false
  )
  RETURNING id INTO v_history_id;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'history_id', v_history_id
  );
END;
$$;

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
    'payment_status', o.payment_status,
    'stock_committed', o.stock_committed,
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

REVOKE ALL ON FUNCTION public.confirm_paid_order_and_commit_stock(TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_paid_order_and_commit_stock(TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_paid_order_and_commit_stock(TEXT, TEXT, NUMERIC, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_order_and_restore_stock(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order_and_restore_stock(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_and_restore_stock(UUID, TEXT, TEXT) TO service_role;

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
