import { supabase } from './supabaseClient';

/**
 * Upload a photo to Supabase Storage
 * @param file The photo file to upload
 * @param path The storage path (will be namespaced under hazard-photos/)
 * @returns Public URL of the uploaded file
 */
export async function uploadHazardPhoto(file: File): Promise<string | null> {
  try {
    // Create a unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}.${fileExt}`;
    const path = `hazard-photos/${fileName}`;

    // Upload file
    const { data, error } = await supabase.storage
      .from('hazard-photos')
      .upload(path, file);

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
 */
export async function deleteHazardPhoto(photoUrl: string): Promise<boolean> {
  try {
    // Extract path from URL
    const url = new URL(photoUrl);
    const path = url.pathname.replace(/^\/[^/]+\//, ''); // Remove bucket prefix

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