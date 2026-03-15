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
            'variant_size', oi.variant_size,
            'variant_color', oi.variant_color,
            'variant_color_hex', oi.variant_color_hex,
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
