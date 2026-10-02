export type HazardAgeFilter = 'all' | '24h' | '7d' | '30d';
export type AdvisoryStateFilter = 'all' | 'active' | 'inactive' | 'upcoming' | 'expired';
export type AccountStateFilter = 'all' | 'active' | 'suspended';
export type AdvisoryGeometryMode = 'Point' | 'LineString' | 'Polygon';
export type AdvisoryCoordinate = [longitude: number, latitude: number];

interface HazardFilterItem {
  hazard_type: string;
  description: string | null;
  location?: unknown;
  status: string;
  severity: string;
  created_at: string;
}

interface AdvisoryFilterItem {
  title: string;
  description: string | null;
  advisory_type: string;
  is_active: boolean;
  start_time: string | null;
  end_time: string | null;
}

interface ProfileFilterItem {
  full_name: string | null;
  email: string;
  role: string;
  is_suspended: boolean;
}

function includesText(value: string | null | undefined, search: string): boolean {
  return (value ?? '').toLocaleLowerCase().includes(search);
}

export function filterHazards<T extends HazardFilterItem>(
  hazards: T[],
  searchTerm: string,
  status: string,
  severity: string,
  age: HazardAgeFilter,
  now = Date.now()
): T[] {
  const search = searchTerm.trim().toLocaleLowerCase();
  const ageMilliseconds: Record<HazardAgeFilter, number> = {
    all: Number.POSITIVE_INFINITY,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };

  return hazards.filter(hazard => {
    const matchesSearch = !search || includesText(hazard.hazard_type, search) || includesText(hazard.description, search) || includesText(JSON.stringify(hazard.location), search);
    const matchesStatus = status === 'all' || hazard.status === status;
    const matchesSeverity = severity === 'all' || hazard.severity === severity;
    const matchesAge = now - new Date(hazard.created_at).getTime() <= ageMilliseconds[age];
    return matchesSearch && matchesStatus && matchesSeverity && matchesAge;
  });
}

export function getAdvisoryState(advisory: AdvisoryFilterItem, now = Date.now()): Exclude<AdvisoryStateFilter, 'all'> {
  const startTime = advisory.start_time ? new Date(advisory.start_time).getTime() : Number.NEGATIVE_INFINITY;
  const endTime = advisory.end_time ? new Date(advisory.end_time).getTime() : Number.POSITIVE_INFINITY;

  if (endTime < now) return 'expired';
  if (startTime > now) return 'upcoming';
  return advisory.is_active ? 'active' : 'inactive';
}

export function filterAdvisories<T extends AdvisoryFilterItem>(
  advisories: T[],
  searchTerm: string,
  type: string,
  state: AdvisoryStateFilter,
  now = Date.now()
): T[] {
  const search = searchTerm.trim().toLocaleLowerCase();
  return advisories.filter(advisory => {
    const matchesSearch = !search || includesText(advisory.title, search) || includesText(advisory.description, search);
    const matchesType = type === 'all' || advisory.advisory_type === type;
    const matchesState = state === 'all' || getAdvisoryState(advisory, now) === state;
    return matchesSearch && matchesType && matchesState;
  });
}

export function filterProfiles<T extends ProfileFilterItem>(
  profiles: T[],
  searchTerm: string,
  role: string,
  state: AccountStateFilter
): T[] {
  const search = searchTerm.trim().toLocaleLowerCase();
  return profiles.filter(profile => {
    const matchesSearch = !search || includesText(profile.full_name, search) || includesText(profile.email, search);
    const matchesRole = role === 'all' || profile.role === role;
    const matchesState = state === 'all' || (state === 'suspended' ? profile.is_suspended : !profile.is_suspended);
    return matchesSearch && matchesRole && matchesState;
  });
}

export function createAdvisoryGeometry(
  mode: AdvisoryGeometryMode,
  coordinates: unknown
): { type: AdvisoryGeometryMode; coordinates: unknown } | null {
  const isCoordinate = (value: unknown): value is AdvisoryCoordinate =>
    Array.isArray(value) && value.length === 2 &&
    typeof value[0] === 'number' && typeof value[1] === 'number';
  const isCoordinateList = (value: unknown): value is AdvisoryCoordinate[] =>
    Array.isArray(value) && value.every(isCoordinate);

  if (mode === 'Point') {
    const point = isCoordinate(coordinates)
      ? coordinates
      : Array.isArray(coordinates) && isCoordinate(coordinates[0])
        ? coordinates[0]
        : null;
    if (!point || !isValidAdvisoryCoordinate(point)) return null;
    return { type: mode, coordinates: point };
  }

  const coordinateList = mode === 'Polygon' && Array.isArray(coordinates) && !isCoordinateList(coordinates)
    ? coordinates[0]
    : coordinates;
  if (!isCoordinateList(coordinateList) || coordinateList.some(coordinate => !isValidAdvisoryCoordinate(coordinate))) return null;

  if (mode === 'LineString') return coordinateList.length >= 2 ? { type: mode, coordinates: coordinateList } : null;
  if (coordinateList.length < 3) return null;
  const ring = [...coordinateList];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return { type: mode, coordinates: [ring] };
}

function isValidAdvisoryCoordinate([longitude, latitude]: AdvisoryCoordinate): boolean {
  return Number.isFinite(longitude) && Number.isFinite(latitude) &&
    longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}

function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[\t\r\n ]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}