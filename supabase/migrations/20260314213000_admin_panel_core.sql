CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  link VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON public.admin_notifications (is_read);

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  action VARCHAR(100) NOT NULL,
  target_table VARCHAR(100),
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_id ON public.admin_activity_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action ON public.admin_activity_log (action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON public.admin_activity_log (created_at DESC);

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

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage products" ON public.products;
CREATE POLICY "admin manage products"
ON public.products
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "admin manage categories" ON public.categories;
CREATE POLICY "admin manage categories"
ON public.categories
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "admin manage orders" ON public.orders;
CREATE POLICY "admin manage orders"
ON public.orders
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "admin manage order items" ON public.order_items;
CREATE POLICY "admin manage order items"
ON public.order_items
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "admin manage order status history" ON public.order_status_history;
CREATE POLICY "admin manage order status history"
ON public.order_status_history
FOR ALL
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "admin read customers" ON public.customers;
CREATE POLICY "admin read customers"
ON public.customers
FOR SELECT
USING (public.current_user_is_admin());

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

DROP POLICY IF EXISTS "admin read activity log" ON public.admin_activity_log;
CREATE POLICY "admin read activity log"
ON public.admin_activity_log
FOR SELECT
USING (public.current_user_is_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
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
