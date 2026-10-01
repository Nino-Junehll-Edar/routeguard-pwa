import { describe, expect, it } from 'vitest';
import { normalizeHazardLocation } from './geoUtils';

describe('normalizeHazardLocation', () => {
  it('decodes PostGIS EWKB geography points', () => {
    const bytes = new ArrayBuffer(25);
    const view = new DataView(bytes);
    view.setUint8(0, 1);
    view.setUint32(1, 0x20000001, true);
    view.setUint32(5, 4326, true);
    view.setFloat64(9, 124.993535, true);
    view.setFloat64(17, 11.216486, true);
    const ewkb = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

    expect(normalizeHazardLocation(ewkb)).toEqual([124.993535, 11.216486]);
  });

  it('accepts coordinate arrays and GeoJSON points', () => {
    expect(normalizeHazardLocation([125, 11.2])).toEqual([125, 11.2]);
    expect(normalizeHazardLocation({ type: 'Point', coordinates: [125, 11.2] })).toEqual([125, 11.2]);
  });

  it('parses WKT points and rejects invalid locations', () => {
    expect(normalizeHazardLocation('POINT(125 11.2)')).toEqual([125, 11.2]);
    expect(normalizeHazardLocation('not a point')).toBeNull();
  });
});