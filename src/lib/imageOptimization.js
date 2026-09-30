// Image optimization utilities for RouteGuard PWA
// Provides image resizing and compression before upload to reduce storage usage and improve performance

/**
 * Resize and compress an image file
 * @param {File} file - The image file to optimize
 * @param {Object} options - Optimization options
 * @param {number} options.maxWidth - Maximum width in pixels (default: 1200)
 * @param {number} options.maxHeight - Maximum height in pixels (default: 1200)
 * @param {number} options.quality - JPEG/WebP quality (0-1, default: 0.8)
 * @param {string} options.format - Output format ('jpeg', 'webp', 'png', default: 'webp')
 * @returns {Promise<Blob>} - Optimized image as Blob
 */
export async function optimizeImage(file, options = {}) {
  // Default options
  const settings = {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8,
    format: 'webp',
    ...options
  };

  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image');
  }

  // Create image bitmap
  const imageBitmap = await createImageBitmap(file);

  // Calculate new dimensions maintaining aspect ratio
  let width = imageBitmap.width;
  let height = imageBitmap.height;

  if (width > settings.maxWidth || height > settings.maxHeight) {
    const widthRatio = settings.maxWidth / width;
    const heightRatio = settings.maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio);

    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Create canvas and draw image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  // Convert to blob with specified format and quality
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      `image/${settings.format}`,
      settings.quality
    );
  });
}

/**
 * Upload an optimized hazard photo to Supabase Storage
 * @param {File} file - The photo file to upload
 * @param {Object} options - Optimization options (same as optimizeImage)
 * @param {string} path - Storage path (will be namespaced under hazard-photos/)
 * @returns {Promise<string|null>} - Public URL of the uploaded file or null if failed
 */
export async function uploadOptimizedHazardPhoto(file, options = {}) {
  try {
    // Optimize the image
    const optimizedBlob = await optimizeImage(file, options);

    // Create a file from the blob with appropriate extension
    const ext = options.format === 'jpeg' ? 'jpg' : options.format;
    const fileName = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}.${ext}`;
    const path = `hazard-photos/${fileName}`;
    const optimizedFile = new File([optimizedBlob], fileName, {
      type: `image/${options.format}`,
      lastModified: Date.now()
    });

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('hazard-photos')
      .upload(path, optimizedFile);

    if (error) {
      console.error('Error uploading optimized photo:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = await supabase.storage
      .from('hazard-photos')
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadOptimizedHazardPhoto:', error);
    return null;
  }
}

/**
 * Get storage savings estimate from optimization
 * @param {File} originalFile - Original file
 * @param {File} optimizedFile - Optimized file
 * @returns {Object} - Savings information
 */
export function getStorageSavings(originalFile, optimizedFile) {
  const originalSize = originalFile.size;
  const optimizedSize = optimizedFile.size;
  const savings = originalSize - optimizedSize;
  const savingsPercent = originalSize > 0 ? (savings / originalSize) * 100 : 0;

  return {
    originalSize,
    optimizedSize,
    savings,
    savingsPercent
  };
}

/**
 * Create a preview of optimized image
 * @param {File} file - Original image file
 * @param {Object} options - Optimization options
 * @returns {Promise<string>} - Data URL of optimized image preview
 */
export async function createOptimizedPreview(file, options = {}) {
  try {
    const optimizedBlob = await optimizeImage(file, options);
    return URL.createObjectURL(optimizedBlob);
  } catch (error) {
    console.error('Error creating optimized preview:', error);
    return null;
  }
}

export default {
  optimizeImage,
  uploadOptimizedHazardPhoto,
  getStorageSavings,
  createOptimizedPreview
};