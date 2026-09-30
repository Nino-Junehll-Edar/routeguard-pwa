// Mock environment variables FIRST
vi.stubEnv('VITE_SUPABASE_URL', 'http://fake-url');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-key');

// Mock the modules that are used in the source code
vi.mock('../../src/lib/profileUtils.js', () => ({
  loadUserProfile: vi.fn().mockResolvedValue({})
}));
vi.mock('../../src/lib/authStore.js', () => ({
  user: {
    get: vi.fn(),
    set: vi.fn(),
    subscribe: vi.fn()
  }
}));

// Set up hoisted mock for supabaseClient
const mockSupabase = vi.hoisted(() => ({
  rpc: vi.fn()
}));

// Mock the modules before importing
vi.mock('../../src/lib/supabaseClient.js', () => ({
  supabase: mockSupabase
}));

// Import the functions we want to test inside each test to ensure proper mocking
describe('Agency request RPCs', () => {
  let approveAgencyRequest;
  let rejectAgencyRequest;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-import the functions to get the mocked version using ES module import
    const agencyUtils = await import('../../src/lib/agencyUtils.js');
    approveAgencyRequest = agencyUtils.approveAgencyRequest;
    rejectAgencyRequest = agencyUtils.rejectAgencyRequest;
  });

  describe('approveAgencyRequest', () => {
    it('should approve a request using the authenticated server-side reviewer', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await approveAgencyRequest('request-1');

      expect(result).toEqual({ success: true });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('approve_agency_request', {
        p_request_id: 'request-1'
      });
    });

    it('should return the RPC error when approval fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Admin access required' } });

      const result = await approveAgencyRequest('request-2');

      expect(result).toEqual({
        success: false,
        error: 'Admin access required'
      });
    });

    it('should handle RPC execution errors', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('RPC failed'));

      await expect(approveAgencyRequest('request-3')).rejects.toThrow('RPC failed');
    });
  });

  describe('rejectAgencyRequest', () => {
    it('should reject a request through the authenticated RPC', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await rejectAgencyRequest('request-1');

      expect(result).toEqual({ success: true });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('reject_agency_request', {
        p_request_id: 'request-1'
      });
    });

    it('should return the RPC error when rejection fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Agency request not found' } });

      const result = await rejectAgencyRequest('request-2');

      expect(result).toEqual({
        success: false,
        error: 'Agency request not found'
      });
    });

    it('should handle RPC execution errors', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('RPC failed'));

      await expect(rejectAgencyRequest('request-3')).rejects.toThrow('RPC failed');
    });
  });
});