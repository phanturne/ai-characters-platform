-- Create storage bucket for chat attachments
DO $$
BEGIN
  -- Create the chat-attachments bucket
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'chat-attachments',
    'chat-attachments',
    false,
    5242880, -- 5MB in bytes
    ARRAY['image/jpeg', 'image/png']
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Create storage policies for the bucket
-- Policy 1: Allow users to upload to their own folder
CREATE POLICY "Users can upload to own folder" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-attachments' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy 2: Allow users to view files they own
CREATE POLICY "Users can view own files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'chat-attachments' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy 3: Allow users to update their own files
CREATE POLICY "Users can update own files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'chat-attachments' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy 4: Allow users to delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'chat-attachments' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );