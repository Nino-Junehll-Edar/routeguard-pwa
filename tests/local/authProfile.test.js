import { beforeEach, describe, expect, it, vi } from 'vitest';

// Track store values
let authLoadingValue = true;
let authErrorValue = null;
let profileLoadingValue = false;
let profileErrorValue = null;
let userValue = null;
let profileValue = null;

// Mock stores (we will assign the mocked store objects to these in beforeEach)
let user;
let authLoading;
let authError;
let profileLoading;
let profileError;

// Set up hoisted mock for supabase
const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((callback) => {
      // Store the callback so we can invoke it later in tests
      mockSupabase.authStateChangeCallback = callback;
      return { unsubscribe: vi.fn() };
    }),
    signOut: vi.fn()
  }
}));

describe('Auth state management', () => {
  let initAuth;
  let signOut;
  let loadProfile;
  let mockNavigate;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset store values
    authLoadingValue = true;
    authErrorValue = null;
    profileLoadingValue = false;
    profileErrorValue = null;
    userValue = null;
    profileValue = null;

    // Create a mock for the goto function
    mockNavigate = vi.fn();

    // Mock $app/navigation before importing any modules that use it
    vi.mock('$app/navigation', () => ({
      goto: mockNavigate
    }));

    // Mock the $lib aliases that are used in the source code
    vi.mock('$lib/profileUtils', () => ({
      loadUserProfile: vi.fn().mockResolvedValue({})
    }));

    // Mock supabaseClient
    vi.mock('../../src/lib/supabaseClient.js', () => ({
      supabase: mockSupabase
    }));

    // Mock the profile store that authStore.js imports
    vi.mock('../../src/lib/stores/profile.js', () => ({
      // Mock the profile store
      profile: {
        get: vi.fn(() => profileValue),
        set: vi.fn((val) => { profileValue = val; }),
        subscribe: vi.fn((callback) => {
          // Call callback immediately with current value
          callback(profileValue);
          return { unsubscribe: vi.fn() };
        })
      },
      // Mock the loadProfile function
      loadProfile: vi.fn()
    }));

    // Import the real authStore module with mocked dependencies
    const authStore = await import('../../src/lib/authStore.js');
    initAuth = authStore.initAuth;
    signOut = authStore.signOut;
    // Import the stores directly to track their values
    const storeModules = await import('../../src/lib/authStore.js');
    user = storeModules.user;
    authLoading = storeModules.authLoading;
    authError = storeModules.authError;
    profileLoading = storeModules.profileLoading;
    profileError = storeModules.profileError;

    // Get loadProfile from profileUtils (now mocked)
    const profileUtils = await import('$lib/profileUtils');
    loadProfile = profileUtils.loadUserProfile;
  });

  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
  const mockSession = { user: mockUser };

  describe('initAuth', () => {
    it('should initialize auth loading state', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
      // Set initial authLoading state to true
      authLoadingValue = true;

      await initAuth();

      // After initialization, authLoading should be false
      expect(authLoadingValue).toBe(false);
    });

    it('should handle session retrieval correctly', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });

      await initAuth();

      expect(userValue).toEqual(mockUser);
      expect(loadProfile).toHaveBeenCalled();
      expect(profileLoadingValue).toBe(false);
    });

    it('should handle no session case', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });

      await initAuth();

      expect(userValue).toBeNull();
    });

    it('should set up auth state change listener', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });

      await initAuth();

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    it('should handle auth initialization errors', async () => {
      const testError = new Error('Auth initialization failed');
      mockSupabase.auth.getSession.mockRejectedValue(testError);
      // Set up initial state
      authLoadingValue = true;
      authErrorValue = null;

      await initAuth();

      expect(authLoadingValue).toBe(false);
      expect(authErrorValue).toBe('Auth initialization failed');
      expect(userValue).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should call supabase auth signOut', async () => {
      await signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should propagate signOut errors', async () => {
      const testError = new Error('Sign out failed');
      mockSupabase.auth.signOut.mockRejectedValue(testError);

      await expect(signOut()).rejects.toThrow(testError);
    });
  });

  describe('auth state change handling', () => {
    it('should handle SIGNED_IN event correctly', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });

      await initAuth();

      // Invoke the stored auth state change callback
      if (mockSupabase.authStateChangeCallback) {
        mockSupabase.authStateChangeCallback('SIGNED_IN', { user: mockUser });
      }

      expect(userValue).toEqual(mockUser);
      expect(loadProfile).toHaveBeenCalled();
    });

    it('should handle SIGNED_OUT event correctly', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });

      await initAuth();

      // Invoke the stored auth state change callback
      if (mockSupabase.authStateChangeCallback) {
        mockSupabase.authStateChangeCallback('SIGNED_OUT', null);
      }

      expect(userValue).toBeNull();
      // Check if goto was called with '/map'
      expect(mockNavigate).toHaveBeenCalledWith('/map');
    });

    it('should handle profile loading errors during auth state change', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockUser } });

      await initAuth();

      // Invoke the stored auth state change callback
      if (mockSupabase.authStateChangeCallback) {
        mockSupabase.authStateChangeCallback('SIGNED_IN', { user: mockUser });
      }

      // Wait for any pending promises to settle
      await Promise.resolve();

      // Now test the error case by rejecting loadProfile
      const testError = new Error('Profile load failed');
      loadProfile.mockRejectedValue(testError);

      // Trigger another auth state change to test error handling
      if (mockSupabase.authStateChangeCallback) {
        mockSupabase.authStateChangeCallback('SIGNED_IN', { user: mockUser });
      }

      // Wait for any pending promises to settle
      await Promise.resolve();

      expect(profileLoadingValue).toBe(false);
      expect(profileErrorValue).toBe('Profile load failed');
    });
  });
});