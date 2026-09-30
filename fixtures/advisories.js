// Test data fixtures for official advisories
export const testAdvisories = [
  {
    id: 'advisory-1',
    title: 'Real St Roadwork - Lane Closure',
    type: 'roadwork',
    active: true,
    geometry: {
      type: 'LineString',
      coordinates: [
        [125.0030, 11.2435],
        [125.0040, 11.2435],
        [125.0050, 11.2435]
      ]
    },
    start_time: '2026-09-25T08:00:00Z',
    end_time: '2026-09-30T17:00:00Z',
    published_by: 'LGU DRRM Office',
    created_at: '2026-09-24T14:30:00Z',
    updated_at: '2026-09-24T14:30:00Z'
  },
  {
    id: 'advisory-2',
    title: 'Flood-Prone Zone - Nula-tula Area',
    type: 'flood_zone',
    active: true,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [125.0080, 11.2400],
        [125.0120, 11.2400],
        [125.0120, 11.2450],
        [125.0080, 11.2450],
        [125.0080, 11.2400]
      ]]
    },
    start_time: '2026-09-01T00:00:00Z',
    end_time: '2026-10-31T23:59:59Z', // Seasonal
    published_by: 'LGU DRRM Office',
    created_at: '2026-08-31T16:00:00Z',
    updated_at: '2026-08-31T16:00:00Z'
  }
];

export const testAdvisoryTypes = ['road_closure', 'roadwork', 'flood_zone', 'event'];