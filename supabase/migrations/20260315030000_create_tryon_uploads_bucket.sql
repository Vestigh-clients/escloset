INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tryon-uploads',
  'tryon-uploads',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public tryon uploads" ON storage.objects;
CREATE POLICY "public tryon uploads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'tryon-uploads');

DROP POLICY IF EXISTS "public tryon reads" ON storage.objects;
CREATE POLICY "public tryon reads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'tryon-uploads');
