import { describe, expect, it } from 'vitest';
import { createAdvisoryGeometry, filterAdvisories, filterHazards, filterProfiles, getAdvisoryState, toCsv } from './staffWorkflowUtils';

const now = Date.parse('2026-10-02T12:00:00.000Z');

describe('staff workflow filters', () => {
  it('filters hazards by text, status, severity, and age', () => {
    const hazards = [
      { hazard_type: 'flood', description: 'River overflow', status: 'needs_verification', severity: 'impassable', created_at: '2026-10-02T10:00:00.000Z' },
      { hazard_type: 'pothole', description: 'Road damage', status: 'hazard_active', severity: 'passable', created_at: '2026-09-20T10:00:00.000Z' }
    ];

    expect(filterHazards(hazards, 'river', 'needs_verification', 'impassable', '24h', now)).toEqual([hazards[0]]);
    expect(filterHazards(hazards, '', 'all', 'all', '7d', now)).toEqual([hazards[0]]);
  });

  it('classifies and filters advisory lifecycle state', () => {
    const advisories = [
      { title: 'Bridge closure', description: 'Repair work', advisory_type: 'roadwork', is_active: true, start_time: null, end_time: '2026-10-03T00:00:00.000Z' },
      { title: 'Festival', description: null, advisory_type: 'event', is_active: true, start_time: '2026-10-03T00:00:00.000Z', end_time: null },
      { title: 'Old notice', description: null, advisory_type: 'weather', is_active: false, start_time: null, end_time: '2026-10-01T00:00:00.000Z' }
    ];

    expect(getAdvisoryState(advisories[0], now)).toBe('active');
    expect(filterAdvisories(advisories, 'bridge', 'roadwork', 'active', now)).toEqual([advisories[0]]);
    expect(filterAdvisories(advisories, '', 'all', 'upcoming', now)).toEqual([advisories[1]]);
    expect(filterAdvisories(advisories, '', 'all', 'expired', now)).toEqual([advisories[2]]);
  });

  it('filters profiles by role and account state', () => {
    const profiles = [
      { full_name: 'Agency One', email: 'agency@example.test', role: 'agency_personnel', is_suspended: false },
      { full_name: 'Community One', email: 'user@example.test', role: 'common_user', is_suspended: true }
    ];

    expect(filterProfiles(profiles, 'example.test', 'agency_personnel', 'active')).toEqual([profiles[0]]);
    expect(filterProfiles(profiles, 'community', 'all', 'suspended')).toEqual([profiles[1]]);
  });

  it('quotes CSV values and neutralizes spreadsheet formulas', () => {
    expect(toCsv(['Name', 'Details'], [['=HYPERLINK("x")', 'line, "quoted"']])).toBe(
      '"Name","Details"\r\n"\'=HYPERLINK(""x"")","line, ""quoted"""'
    );
  });

  it('requires valid geometry coordinates and closes polygon rings', () => {
    expect(createAdvisoryGeometry('Point', [[125, 11]])).toEqual({ type: 'Point', coordinates: [125, 11] });
    expect(createAdvisoryGeometry('LineString', [[125, 11]])).toBeNull();
    expect(createAdvisoryGeometry('Polygon', [[125, 11], [126, 11], [126, 12]])).toEqual({
      type: 'Polygon',
      coordinates: [[[125, 11], [126, 11], [126, 12], [125, 11]]]
    });
    expect(createAdvisoryGeometry('Point', [125, 11])).toEqual({ type: 'Point', coordinates: [125, 11] });
    expect(createAdvisoryGeometry('Polygon', [[[125, 11], [126, 11], [126, 12]]])).toEqual({
      type: 'Polygon',
      coordinates: [[[125, 11], [126, 11], [126, 12], [125, 11]]]
    });
    expect(createAdvisoryGeometry('Point', [[181, 11]])).toBeNull();
  });
});