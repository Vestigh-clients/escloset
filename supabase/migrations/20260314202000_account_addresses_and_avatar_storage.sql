ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
