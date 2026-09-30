// Test data fixtures for user profiles
export const testUsers = [
  {
    id: 'user-1',
    email: 'user1@example.com',
    full_name: 'John Doe',
    role: 'common',
    reputation_points: 45,
    member_since: '2026-01-15',
    status: 'active',
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-09-27T10:30:00Z'
  },
  {
    id: 'user-2',
    email: 'user2@example.com',
    full_name: 'Jane Smith',
    role: 'agency_personnel',
    reputation_points: 120,
    member_since: '2025-11-01',
    status: 'active',
    created_at: '2025-11-01T09:00:00Z',
    updated_at: '2026-09-27T11:15:00Z'
  },
  {
    id: 'user-3',
    email: 'user3@example.com',
    full_name: 'Admin User',
    role: 'admin',
    reputation_points: 250,
    member_since: '2025-08-20',
    status: 'active',
    created_at: '2025-08-20T10:30:00Z',
    updated_at: '2026-09-27T12:00:00Z'
  },
  {
    id: 'user-4',
    email: 'user4@example.com',
    full_name: 'Inactive User',
    role: 'common',
    reputation_points: 10,
    member_since: '2026-03-10',
    status: 'inactive',
    created_at: '2026-03-10T14:00:00Z',
    updated_at: '2026-05-20T09:30:00Z'
  }
];

export const testUserRoles = ['common', 'agency_personnel', 'admin'];

export const testUserStatuses = ['active', 'inactive', 'suspended'];