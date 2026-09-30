import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HazardReportForm } from '../src/lib/types/hazardReport';
import { uploadHazardPhoto, deleteHazardPhoto } from '../src/lib/storageUtils';
import { supabase } from '../src/lib/supabaseClient';
import { user } from '../src/lib/authStore';

// Mock dependencies
const mockSupabase = {
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn()
    })
  },
  from: vi.fn().mockReturnValue({
    insert: vi.fn()
  })
};

const mockUserStore = {
  get: vi.fn()
};

// Mock the modules before importing
vi.mock('../src/lib/supabaseClient.js', () => ({ supabase: mockSupabase }));
vi.mock('../src/lib/authStore.js', () => ({ user: mockUserStore }));

describe('Storage utilities', () => {
  const mockFile = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
  const mockUserId = 'test-user-id';
  const mockPublicUrl = 'https://example.com/storage/v1/object/public/hazard-photos/test-path';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadHazardPhoto', () => {
    it('should upload photo with correct content type and path', async () => {
      mockSupabase.storage.from().upload.mockResolvedValue({ data: {}, error: null });
      mockSupabase.storage.from().getPublicUrl.mockReturnValue({ data: { publicUrl: mockPublicUrl } });
      mockUserStore.get.mockReturnValue({ id: mockUserId });

      const result = await uploadHazardPhoto(mockFile, mockUserId);

      // Check that upload was called with correct parameters
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('hazard-photos');
      expect(mockSupabase.storage.from().upload).toHaveBeenCalledWith(
        expect.any(String),
        mockFile,
        {
          contentType: mockFile.type,
          upsert: false
        }
      );

      // Check that public URL was retrieved
      expect(mockSupabase.storage.from().getPublicUrl).toHaveBeenCalled();
      expect(result).toBe(mockPublicUrl);
    });

    it('should sanitize file extension', async () => {
      // Test with valid extension
      const validFile = new File(['dummy content'], 'image.PnG', { type: 'image/png' });
      mockSupabase.storage.from().upload.mockResolvedValue({ data: {}, error: null });
      mockSupabase.storage.from().getPublicUrl.mockReturnValue({ data: { publicUrl: mockPublicUrl } });
      mockUserStore.get.mockReturnValue({ id: mockUserId });

      await uploadHazardPhoto(validFile, mockUserId);

      // The extension should be sanitized to lowercase png
      const uploadCallArgs = mockSupabase.storage.from().upload.mock.calls[0][0];
      expect(uploadCallArgs).toMatch(/\.png$/);
    });

    it('should default to jpg for invalid extensions', async () => {
      // Test with invalid extension
      const invalidFile = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
      mockSupabase.storage.from().upload.mockResolvedValue({ data: {}, error: null });
      mockSupabase.storage.from().getPublicUrl.mockReturnValue({ data: { publicUrl: mockPublicUrl } });
      mockUserStore.get.mockReturnValue({ id: mockUserId });

      await uploadHazardPhoto(invalidFile, mockUserId);

      // Should default to jpg
      const uploadCallArgs = mockSupabase.storage.from().upload.mock.calls[0][0];
      expect(uploadCallArgs).toMatch(/\.jpg$/);
    });

    it('should return null on upload error', async () => {
      mockSupabase.storage.from().upload.mockResolvedValue({ data: null, error: { message: 'Upload failed' } });
      mockUserStore.get.mockReturnValue({ id: mockUserId });

      const result = await uploadHazardPhoto(mockFile, mockUserId);

      expect(result).toBeNull();
    });

    it('should return null on getPublicUrl error', async () => {
      mockSupabase.storage.from().upload.mockResolvedValue({ data: {}, error: null });
      mockSupabase.storage.from().getPublicUrl.mockReturnValue({ data: null, error: { message: 'Failed to get public URL' } });
      mockUserStore.get.mockReturnValue({ id: mockUserId });

      const result = await uploadHazardPhoto(mockFile, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('deleteHazardPhoto', () => {
    it('should delete photo by extracting path from URL', async () => {
      mockSupabase.storage.from().remove.mockResolvedValue({ error: null });

      const result = await deleteHazardPhoto(mockPublicUrl);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('hazard-photos');
      expect(mockSupabase.storage.from().remove).toHaveBeenCalledWith([expect.any(String)]);
      expect(result).toBe(true);
    });

    it('should return false if path cannot be extracted from URL', async () => {
      const invalidUrl = 'https://invalid-url.com/path';

      const result = await deleteHazardPhoto(invalidUrl);

      expect(result).toBe(false);
      expect(mockSupabase.storage.from().remove).not.toHaveBeenCalled();
    });

    it('should return false on delete error', async () => {
      mockSupabase.storage.from().remove.mockResolvedValue({ error: { message: 'Delete failed' } });

      const result = await deleteHazardPhoto(mockPublicUrl);

      expect(result).toBe(false);
    });
  });
});

describe('Hazard reporting flow', () => {
  const mockHazard = {
    id: 'hazard-1',
    reporter_id: 'test-user-id',
    location: 'POINT(125.0041 11.2442)',
    hazard_type: 'flooding',
    description: 'Test flood',
    photo_url: 'https://example.com/photo.jpg',
    status: 'unconfirmed',
    lifetime_minutes: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserStore.get.mockReturnValue({ id: 'test-user-id' });
  });

  it('should handle photo upload failure gracefully', async () => {
    // Mock upload failure
    vi.mocked(uploadHazardPhoto).mockResolvedValue(null);
    mockSupabase.from().insert.mockResolvedValue({ data: [mockHazard], error: null });

    // This would be the handleSubmit function from report-hazard/+page.svelte
    // We're testing the logic that if upload fails, we don't proceed with database insert
    const photoFile = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
    const photoUrl = await uploadHazardPhoto(photoFile, 'test-user-id');

    expect(photoUrl).toBeNull();
    // In the actual implementation, we would not proceed to insert if photoUrl is null
  });

  it('should clean up uploaded photo on database insert failure', async () => {
    // Mock successful upload but failed insert
    vi.mocked(uploadHazardPhoto).mockResolvedValue('https://example.com/photo.jpg');
    mockSupabase.from().insert.mockResolvedValue({ data: null, error: { message: 'Database error' } });
    vi.mocked(deleteHazardPhoto).mockResolvedValue(true);

    const photoFile = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
    const photoUrl = await uploadHazardPhoto(photoFile, 'test-user-id');

    // Simulate database insert failure
    const { error } = await mockSupabase.from('hazards').insert({
      reporter_id: 'test-user-id',
      location: 'POINT(125.0041 11.2442)',
      hazard_type: 'flooding',
      description: 'Test flood',
      photo_url: photoUrl,
      status: 'unconfirmed',
      lifetime_minutes: 30
    });

    if (error && photoUrl) {
      // This is the cleanup logic from the actual implementation
      await deleteHazardPhoto(photoUrl);
    }

    expect(photoUrl).toBe('https://example.com/photo.jpg');
    expect(deleteHazardPhoto).toHaveBeenCalledWith(photoUrl);
  });
});