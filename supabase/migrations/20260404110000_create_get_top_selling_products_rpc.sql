CREATE OR REPLACE FUNCTION public.get_top_selling_products(p_limit integer DEFAULT 4)
RETURNS TABLE (
  product_id uuid,
  sold_units bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.product_id,
    SUM(GREATEST(COALESCE(oi.quantity, 0), 0))::bigint AS sold_units
  FROM public.order_items oi
  INNER JOIN public.orders o ON o.id = oi.order_id
  WHERE o.payment_status = 'paid'
    AND COALESCE(o.stock_committed, false) = true
    AND o.status <> 'cancelled'
  GROUP BY oi.product_id
  HAVING SUM(GREATEST(COALESCE(oi.quantity, 0), 0)) > 0
  ORDER BY sold_units DESC, MAX(o.created_at) DESC
  LIMIT GREATEST(COALESCE(p_limit, 4), 0);
$$;

REVOKE ALL ON FUNCTION public.get_top_selling_products(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_selling_products(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_top_selling_products(integer) TO authenticated;
