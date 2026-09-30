import { afterEach, describe, expect, it } from 'vitest';
import { testHazards } from '../../fixtures/hazards.js';
import { createSqliteHazardDb } from './sqliteHazardDb.js';

let database;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe('local SQLite hazard database', () => {
  it('returns nearby hazards ordered by distance', () => {
    database = createSqliteHazardDb(testHazards);

    const hazards = database.getHazardsNearPoint(
      { latitude: 11.2442, longitude: 125.0041 },
      250,
      { hazardTypes: ['flooding'] }
    );

    expect(hazards.map((hazard) => hazard.id)).toEqual(['hazard-1', 'hazard-3']);
    expect(hazards[0].distance).toBe(0);
  });

  it('applies status filters and counts matching rows', () => {
    database = createSqliteHazardDb(testHazards);

    expect(database.countHazardsNearPoint(
      { latitude: 11.2442, longitude: 125.0041 },
      500,
      { status: 'hazard_active' }
    )).toBe(1);
  });

  it('supports pagination for route-area queries', () => {
    database = createSqliteHazardDb(testHazards);

    const hazards = database.getHazardsNearPoint(
      { latitude: 11.2442, longitude: 125.0041 },
      1000,
      { offset: 1, limit: 2 }
    );

    expect(hazards).toHaveLength(2);
    expect(hazards[0].id).toBe('hazard-2');
  });
});
