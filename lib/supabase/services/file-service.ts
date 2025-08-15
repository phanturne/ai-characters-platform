import { createClient } from '@/lib/supabase/server';

export interface UploadedFile {
  url: string;
  contentType: string;
  filename: string;
  size: number;
}

export class FileService {
  async uploadFile(
    file: Blob,
    originalFilename: string,
    userId: string,
  ): Promise<UploadedFile> {
    const supabase = await createClient();

    // Create a unique filename with timestamp to avoid conflicts
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${originalFilename}`;

    // Organize files by user ID in folders
    const storagePath = `${userId}/${uniqueFilename}`;

    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Upload error details:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Create a signed URL for external AI providers (7 days expiration)
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(storagePath, 604800);

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
    }

    return {
      url: signedUrlData.signedUrl,
      contentType: file.type,
      filename: originalFilename,
      size: file.size,
    };
  }

  async deleteFile(storagePath: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from('chat-attachments')
      .remove([storagePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }
}
