-- Ensure products_with_stock always reflects variant-level stock for variant-enabled products
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

-- Optional cache sync: keep products.stock_quantity aligned to available variant stock totals
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
