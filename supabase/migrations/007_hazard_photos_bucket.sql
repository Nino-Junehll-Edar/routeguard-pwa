-- Create hazard-photos bucket and set up storage policies

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('hazard-photos', 'hazard-photos', true, 5242880, '{image/jpeg,image/png,image/gif,image/webp}')
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Set up storage policy: allow authenticated users to upload their own files
-- We'll use a bucket policy that restricts uploads to a folder named after the user's id
-- However, note that Supabase Storage policies are evaluated per bucket, not per folder.
-- We can use a policy that checks the object name starts with the user's id.

-- First, allow anyone to read objects (since we set public to true)
-- Actually, if the bucket is public, then reads are already allowed. But we'll explicitly set policy for clarity.

-- Create policy for selecting (reading) objects
CREATE POLICY "Anyone can view hazard photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'hazard-photos');

-- Create policy for inserting (uploading) objects
-- Only authenticated users can upload, and the object path must start with their user id
CREATE POLICY "Authenticated users can upload hazard photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'hazard-photos'
  AND auth.role() = 'authenticated'
  -- Object path format: <user_id>/<filename>
  -- We'll store files in a folder named after the user's id
  AND (storage.folder(name))[1] = auth.uid()::text
);

-- Create policy for updating own objects
CREATE POLICY "Users can update their own hazard photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'hazard-photos'
  AND auth.uid() = (storage.folder(name))[1]::uuid
);

-- Create policy for deleting own objects
CREATE POLICY "Users can delete their own hazard photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'hazard-photos'
  AND auth.uid() = (storage.folder(name))[1]::uuid
);