import { supabase } from './supabaseClient';
import { user } from './authStore';

/**
 * Upload a photo to Supabase Storage
 * @param file The photo file to upload
 * @param userId The user's ID to namespace the upload
 * @returns Public URL of the uploaded file
 */
export async function uploadHazardPhoto(file: File, userId: string): Promise<string | null> {
  try {
    // Extract and sanitize file extension - only allow alphanumeric characters
    const fileExt = file.name.split('.').pop().replace(/[^a-z0-9]/gi, '').toLowerCase();
    // Default to 'jpg' for safety if extension is invalid or empty
    const safeExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const ext = safeExtensions.includes(fileExt) ? fileExt : 'jpg';
    const filepath = `${crypto.randomUUID()}.${ext}`;
    // Store under user's folder: hazard-photos/<userId>/<uuid>.<ext>
    const path = `hazard-photos/${userId}/${filepath}`;

    // Upload file
    const { data, error } = await supabase.storage
      .from('hazard-photos')
      .upload(path, file, {
        // Set content type to match the file
        contentType: file.type,
        // Prevent race condition with same filename
        upsert: false
      });

    if (error) {
      console.error('Error uploading photo:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('hazard-photos')
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadHazardPhoto:', error);
    return null;
  }
}

/**
 * Delete a photo from Supabase Storage
 * @param photoUrl The public URL of the photo to delete
 * @returns True if deleted successfully
 */
export async function deleteHazardPhoto(photoUrl: string): Promise<boolean> {
  try {
    // Extract path from URL
    const url = new URL(photoUrl);
    // Remove the protocol, domain, and bucket part to get the path within the bucket
    // URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const path = url.pathname.split(`/object/public/hazard-photos/`)[1];
    if (!path) {
      console.error('Could not extract path from photo URL:', photoUrl);
      return false;
    }

    const { error } = await supabase.storage
      .from('hazard-photos')
      .remove([path]);

    if (error) {
      console.error('Error deleting photo:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteHazardPhoto:', error);
    return false;
  }
}