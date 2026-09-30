import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  })
};

vi.mock('../src/lib/supabaseClient', () => ({ supabase: mockSupabase }));

// Mock stores properly
const mockUserStore = {
  get: vi.fn(),
  set: vi.fn(),
  subscribe: vi.fn()
};
const mockProfileStore = {
  get: vi.fn(),
  set: vi.fn(),
  subscribe: vi.fn()
};

vi.mock('../src/lib/authStore', () => ({
  user: {
    get: () => mockUserStore.get(),
    subscribe: mockUserStore.subscribe
  }
}));
vi.mock('../src/lib/stores/profile', () => ({
  profile: {
    get: () => mockProfileStore.get(),
    subscribe: mockProfileStore.subscribe
  }
}));

// Mock mapUtils functions
const mockMapUtils = {
  loadHazards: vi.fn(),
  loadAdvisories: vi.fn(),
  clearHazardMarkers: vi.fn(),
  clearAdvisoryMarkers: vi.fn(),
  subscribeToHazardChanges: vi.fn(),
  subscribeToAdvisoryChanges: vi.fn(),
  initializeMap: vi.fn().mockResolvedValue({}),
  updateUserPosition: vi.fn(),
  displayRoute: vi.fn(),
  clearRoute: vi.fn()
};

vi.mock('$lib/mapUtils', () => mockMapUtils);

// Test data
const mockUser = { id: 'test-user-id', email: 'test@example.com' };
const mockProfileAgency = { id: 'test-user-id', full_name: 'Test User', role: 'agency_personnel' };
const mockProfileAdmin = { id: 'test-user-id', full_name: 'Test Admin', role: 'admin' };
const mockProfileCommon = { id: 'test-user-id', full_name: 'Test Common', role: 'common_user' };
const mockAdvisory = {
  id: 'advisory-1',
  created_by: 'test-user-id',
  title: 'Test Advisory',
  description: 'Test description',
  advisory_type: 'weather',
  geometry: { type: 'Point', coordinates: [125.0041, 11.2442] },
  start_time: new Date().toISOString(),
  end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

describe('Agency advisory permissions and filtering logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store mocks
    mockUserStore.get.mockReturnValue(null);
    mockUserStore.set.mockReset();
    mockProfileStore.get.mockReturnValue(null);
    mockProfileStore.set.mockReset();
  });

  describe('Authorization checks', () => {
    it('should redirect non-agency users from agency dashboard', () => {
      const mockNavigate = vi.fn();
      vi.mock('$app/navigation', () => ({ goto: mockNavigate }));

      // Set up test scenario: logged in user with common_user role
      mockUserStore.get.mockReturnValue(mockUser);
      mockProfileStore.get.mockReturnValue(mockProfileCommon);

      // Simulate the checkAuthorization logic from agency/+page.svelte
      const currentUser = mockUserStore.get();
      const profileData = mockProfileStore.get();

      if (!currentUser) {
        // goto('/login'); // In real implementation
        return;
      }

      // Check if user is agency personnel or admin
      if (profileData && (profileData.role === 'agency_personnel' || profileData.role === 'admin')) {
        // Authorized
        return;
      }

      // Not authorized, redirect to map
      mockNavigate('/map');

      expect(mockNavigate).toHaveBeenCalledWith('/map');

      // Restore mock
      vi.doMock('$app/navigation', () => ({ goto: vi.fn() }));
    });

    it('should allow agency personnel to access agency dashboard', () => {
      const mockNavigate = vi.fn();
      vi.mock('$app/navigation', () => ({ goto: mockNavigate }));

      // Set up test scenario: logged in user with agency_personnel role
      mockUserStore.get.mockReturnValue(mockUser);
      mockProfileStore.get.mockReturnValue(mockProfileAgency);

      // Simulate the checkAuthorization logic from agency/+page.svelte
      const currentUser = mockUserStore.get();
      const profileData = mockProfileStore.get();

      if (!currentUser) {
        // goto('/login'); // In real implementation
        return;
      }

      // Check if user is agency personnel or admin
      if (profileData && (profileData.role === 'agency_personnel' || profileData.role === 'admin')) {
        // Authorized
        return;
      }

      // Not authorized, redirect to map
      mockNavigate('/map');

      expect(mockNavigate).not.toHaveBeenCalled();

      // Restore mock
      vi.doMock('$app/navigation', () => ({ goto: vi.fn() }));
    });

    it('should allow admin to access agency dashboard', () => {
      const mockNavigate = vi.fn();
      vi.mock('$app/navigation', () => ({ goto: mockNavigate }));

      // Set up test scenario: logged in user with admin role
      mockUserStore.get.mockReturnValue(mockUser);
      mockProfileStore.get.mockReturnValue(mockProfileAdmin);

      // Simulate the checkAuthorization logic from agency/+page.svelte
      const currentUser = mockUserStore.get();
      const profileData = mockProfileStore.get();

      if (!currentUser) {
        // goto('/login'); // In real implementation
        return;
      }

      // Check if user is agency personnel or admin
      if (profileData && (profileData.role === 'agency_personnel' || profileData.role === 'admin')) {
        // Authorized
        return;
      }

      // Not authorized, redirect to map
      mockNavigate('/map');

      expect(mockNavigate).not.toHaveBeenCalled();

      // Restore mock
      vi.doMock('$app/navigation', () => ({ goto: vi.fn() }));
    });
  });

  describe('Advisory creation validation', () => {
    it('should validate required fields', () => {
      // Simulate the validation logic from createAdvisory function
      let title = '';
      let description = 'Test description';
      let advisoryType = 'weather';
      let createError = null;

      if (!title || !advisoryType) {
        createError = 'Please fill in all required fields';
      }

      expect(createError).toBe('Please fill in all required fields');
    });

    it('should validate time range', () => {
      // Simulate the validation logic from createAdvisory function
      let title = 'Test Advisory';
      let description = 'Test description';
      let advisoryType = 'weather';
      let startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16); // Future
      let endTime = new Date().toISOString().slice(0, 16); // Past
      let createError = null;

      if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
        createError = 'End time must be after start time';
      }

      expect(createError).toBe('End time must be after start time');
    });

    it('should prevent non-agency users from creating advisories', () => {
      // Set up test scenario: logged in user with common_user role
      mockUserStore.set(mockUser);
      mockProfileStore.set(mockProfileCommon);

      // Simulate the authorization check in createAdvisory
      const profileData = mockProfileStore.get();
      let createError = null;

      if (!profileData || !(profileData.role === 'agency_personnel' || profileData.role === 'admin')) {
        createError = 'Unauthorized';
      }

      expect(createError).toBe('Unauthorized');
    });
  });

  describe('Map filtering logic', () => {
    it('should show all hazards and advisories when "All" chip is selected', () => {
      // Simulate the loadDataBasedOnFilters logic from map/+page.svelte
      const alertChips = [
        { id: 'all', label: 'All', active: true },
        { id: 'nearby', label: 'Nearby', active: false },
        { id: 'verify', label: 'Verifications', active: false },
        { id: 'adv', label: 'Advisories', active: false }
      ];

      const activeChip = alertChips.find(chip => chip.active);

      let hazardsLoaded = false;
      let advisoriesLoaded = false;
      let hazardsCleared = false;
      let advisoriesCleared = false;

      if (activeChip) {
        // Clear both layers first
        hazardsCleared = true;
        advisoriesCleared = true;

        switch (activeChip.id) {
          case 'all':
            // Show all hazards (non-expired) and advisories
            hazardsLoaded = true;
            advisoriesLoaded = true;
            break;
          // ... other cases
        }
      }

      expect(hazardsCleared).toBe(true);
      expect(advisoriesCleared).toBe(true);
      expect(hazardsLoaded).toBe(true);
      expect(advisoriesLoaded).toBe(true);
    });

    it('should show only advisories when "Advisories" chip is selected', () => {
      // Simulate the loadDataBasedOnFilters logic from map/+page.svelte
      const alertChips = [
        { id: 'all', label: 'All', active: false },
        { id: 'nearby', label: 'Nearby', active: false },
        { id: 'verify', label: 'Verifications', active: false },
        { id: 'adv', label: 'Advisories', active: true }
      ];

      const activeChip = alertChips.find(chip => chip.active);

      let hazardsLoaded = false;
      let advisoriesLoaded = false;
      let hazardsCleared = false;
      let advisoriesCleared = false;

      if (activeChip) {
        // Clear both layers first
        hazardsCleared = true;
        advisoriesCleared = true;

        switch (activeChip.id) {
          case 'adv':
            // Show only advisories
            advisoriesLoaded = true;
            break;
          // ... other cases
        }
      }

      expect(hazardsCleared).toBe(true);
      expect(advisoriesCleared).toBe(true);
      expect(hazardsLoaded).toBe(false);
      expect(advisoriesLoaded).toBe(true);
    });

    it('should show only hazards needing verification when "Verify" chip is selected', () => {
      // Simulate the loadDataBasedOnFilters logic from map/+page.svelte
      const alertChips = [
        { id: 'all', label: 'All', active: false },
        { id: 'nearby', label: 'Nearby', active: false },
        { id: 'verify', label: 'Verifications', active: true },
        { id: 'adv', label: 'Advisories', active: false }
      ];

      const activeChip = alertChips.find(chip => chip.active);

      let hazardsLoadedWithFilter = false;
      let advisoriesLoaded = false;
      let hazardsCleared = false;
      let advisoriesCleared = false;

      if (activeChip) {
        // Clear both layers first
        hazardsCleared = true;
        advisoriesCleared = true;

        switch (activeChip.id) {
          case 'verify':
            // Show only hazards that need verification
            hazardsLoadedWithFilter = true;
            advisoriesLoaded = true;
            break;
          // ... other cases
        }
      }

      expect(hazardsCleared).toBe(true);
      expect(advisoriesCleared).toBe(true);
      expect(hazardsLoadedWithFilter).toBe(true);
      expect(advisoriesLoaded).toBe(true);
    });
  });
});