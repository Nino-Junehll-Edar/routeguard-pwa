export type HazardCoordinates = [longitude: number, latitude: number];

function validCoordinates(longitude: number, latitude: number): HazardCoordinates | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return [longitude, latitude];
}

export function normalizeHazardLocation(location: unknown): HazardCoordinates | null {
  if (Array.isArray(location) && location.length >= 2) {
    return validCoordinates(Number(location[0]), Number(location[1]));
  }

  if (typeof location === 'object' && location !== null && 'coordinates' in location) {
    const point = location as { type?: unknown; coordinates?: unknown };
    if (point.type === 'Point' && Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
      return validCoordinates(Number(point.coordinates[0]), Number(point.coordinates[1]));
    }
    return null;
  }

  if (typeof location !== 'string') return null;

  const text = location.trim();
  const pointMatch = /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i.exec(text);
  if (pointMatch) {
    return validCoordinates(Number(pointMatch[1]), Number(pointMatch[2]));
  }

  const hexMatch = /^(?:\d+;)?([\da-f]+)$/i.exec(text);
  if (!hexMatch || hexMatch[1].length % 2 !== 0) return null;

  const hex = hexMatch[1];
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  if (bytes.length < 21 || bytes[0] > 1) return null;

  const littleEndian = bytes[0] === 1;
  const view = new DataView(bytes.buffer);
  const geometryType = view.getUint32(1, littleEndian);
  if ((geometryType & 0xff) !== 1) return null;

  const hasSrid = (geometryType & 0x20000000) !== 0;
  const coordinateOffset = 5 + (hasSrid ? 4 : 0);
  if (bytes.length < coordinateOffset + 16) return null;

  return validCoordinates(
    view.getFloat64(coordinateOffset, littleEndian),
    view.getFloat64(coordinateOffset + 8, littleEndian)
  );
}