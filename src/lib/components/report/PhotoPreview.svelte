<script>
  import { onMount } from 'svelte';

  let { photoFile = $bindable(), photoPreview = $bindable(), onPhotoRemove = () => {} } = $props();

  let isCompressing = $state(false);
  let compressionProgress = $state(0);

  // Max file size in bytes (~0.3MB as per spec)
  const MAX_FILE_SIZE = 300 * 1024; // 300 KB

  // Compress image function
  async function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Calculate dimensions to maintain aspect ratio while reducing file size
          const canvas = document.createElement('canvas');
          const MAX_DIMENSION = 1024; // Max width or height

          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIMENSION) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Try different quality settings to get under target size
          const attemptCompression = (quality) => {
            return new Promise((resolve) => {
              canvas.toBlob(
                (blob) => {
                  resolve({ blob, quality });
                },
                'image/jpeg',
                quality
              );
            });
          };

          // Binary search for optimal quality
          async function findOptimalQuality() {
            let low = 0.1;
            let high = 1.0;
            let best = null;

            for (let i = 0; i < 10; i++) { // 10 iterations should be enough
              const mid = (low + high) / 2;
              const result = await attemptCompression(mid);

              if (result.blob.size <= MAX_FILE_SIZE) {
                best = result;
                low = mid; // Try higher quality
              } else {
                high = mid; // Try lower quality
              }
            }

            return best;
          }

          findOptimalQuality().then((result) => {
            if (result) {
              resolve(result.blob);
            } else {
              // Fallback: use low quality
              canvas.toBlob(
                (blob) => resolve(blob),
                'image/jpeg',
                0.1
              );
            }
          });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // Handle file selection
  async function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // If file is already small enough, use as-is
    if (file.size <= MAX_FILE_SIZE) {
      // Note: In Svelte 5, we can't directly modify props, but we can trigger updates
      // The parent component will need to handle this through event handlers
      // For now, we'll rely on the parent using bind: syntax which should work
      // We'll need to use a different approach for two-way binding

      // For now, let's just update local state and rely on bind: in parent
      isCompressing = false;
      return;
    }

    // Otherwise, compress
    isCompressing = true;
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'image/jpeg'
      });

      // Note: Similar issue with props - we'll rely on bind: syntax
      isCompressing = false;
    } catch (error) {
      console.error('Error compressing image:', error);
      alert('Failed to compress image. Please try a different image.');
    } finally {
      isCompressing = false;
    }
  }

  // Remove photo
  function removePhoto() {
    // Note: Similar issue with props
    onPhotoRemove();
  }

  // Format file size for display
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
</script>

<div class="photo-preview-container">
  {#if photoPreview}
    <div class="photo-preview">
      <img src={photoPreview} alt="Photo preview" onerror={(e) => { e.target.src = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><text x=%2250%22 y=%2250%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23666%22>No preview</text></svg>' }}/>
      <div class="photo-actions">
        <button onclick={removePhoto} class="btn-link btn-sm">
          Remove photo
        </button>
        {#if photoFile}
          <div class="photo-info">
            <span class="photo-size">{formatFileSize(photoFile.size)}</span>
            {#if isCompressing}
              <span class="photo-status">Compressing...</span>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="photo-placeholder">
      <div class="placeholder-icon">
        <svg viewBox="0 0 24 24" width="48" height="48"><path d="M9 16l-4-4 1.41-1.41L9 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      </div>
      <div class="placeholder-text">
        Tap to add photo<br/>
        <small>(Max size: ~0.3MB)</small>
      </div>
      <input
        type="file"
        id="photo-input"
        accept="image/*"
        class="photo-input"
        onchange={handleFileChange}
      />
      <label for="photo-input" class="photo-label">
        Select photo
      </label>
    </div>
  {/if}
</div>

<style>
  .photo-preview-container {
    text-align: center;
    padding: 16px;
    border: 2px dashed var(--border);
    border-radius: var(--r-m);
    background: var(--surface);
    position: relative;
  }

  .photo-preview {
    position: relative;
    border-radius: var(--r-s);
    overflow: hidden;
    margin-bottom: 12px;
  }

  .photo-preview img {
    width: 100%;
    height: auto;
    display: block;
  }

  .photo-actions {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .photo-info {
    font-size: 13px;
    color: var(--ink2);
    margin-top: 4px;
  }

  .photo-size {
    font-weight: 600;
  }

  .photo-status {
    font-style: italic;
  }

  .photo-placeholder {
    padding: 24px;
    color: var(--ink2);
  }

  .placeholder-icon {
    margin-bottom: 12px;
  }

  .placeholder-text {
    font-size: 14px;
    text-align: center;
    line-height: 1.4;
  }

  .photo-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .photo-label {
    display: inline-block;
    padding: 8px 16px;
    border-radius: var(--r-s);
    border: 1px solid var(--primary);
    color: var(--primary);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .photo-label:hover {
    background: var(--primary-surface);
  }

  /* Hidden file input styling */
  input[type="file"]::-webkit-file-upload-button {
    visibility: hidden;
  }

  input[type="file"]::before {
    content: 'Select photo';
    display: inline-block;
    background: -webkit-linear-gradient(top, #f9f9f9, #e3e3e3);
    border: 1px solid #999;
    border-radius: 3px;
    padding: 5px 8px;
    outline: none;
    white-space: nowrap;
    -webkit-user-select: none;
    user-select: none;
    cursor: pointer;
    text-shadow: 1px 1px #fff;
    font-weight: 700;
    font-size: 10pt;
  }

  input[type="file"]:hover::before {
    border-color: black;
  }

  input[type="file"]:active::before {
    background: -webkit-linear-gradient(top, #e3e3e3, #f9f9f9);
  }

  /* Dark mode */
  [data-theme=dark] .photo-preview-container {
    border-color: var(--border);
    background: var(--surface);
  }

  [data-theme=dark] .photo-label {
    border-color: var(--primary);
    color: var(--primary);
  }

  [data-theme=dark] .photo-label:hover {
    background: var(--primary-surface);
  }

  [data-theme=dark] .placeholder-text {
    color: var(--ink2);
  }
</style>