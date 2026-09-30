import Database from 'better-sqlite3';

const EARTH_RADIUS_METERS = 6371000;

function parsePoint(location) {
  const match = /^POINT\((-?[\d.]+)\s+(-?[\d.]+)\)$/.exec(location);
  if (!match) {
    throw new Error(`Unsupported fixture location: ${location}`);
  }

  return { longitude: Number(match[1]), latitude: Number(match[2]) };
}

function haversineDistance(from, to) {
  const latitudeDelta = (to.latitude - from.latitude) * Math.PI / 180;
  const longitudeDelta = (to.longitude - from.longitude) * Math.PI / 180;
  const fromLatitude = from.latitude * Math.PI / 180;
  const toLatitude = to.latitude * Math.PI / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE hazards (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      longitude REAL NOT NULL,
      latitude REAL NOT NULL,
      hazard_type TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function seedHazards(db, hazards) {
  const insert = db.prepare(`
    INSERT INTO hazards (
      id, reporter_id, longitude, latitude, hazard_type, status,
      description, created_at, updated_at
    ) VALUES (@id, @reporter_id, @longitude, @latitude, @hazard_type, @status,
      @description, @created_at, @updated_at)
  `);

  const seed = db.transaction((rows) => {
    for (const hazard of rows) {
      const point = parsePoint(hazard.location);
      insert.run({ ...hazard, ...point });
    }
  });

  seed(hazards);
}

function createHazardQuery(db) {
  return (point, radiusMeters = 500, options = {}) => {
    const rows = db.prepare(`
      SELECT id, reporter_id, longitude, latitude, hazard_type, status,
        description, created_at, updated_at
      FROM hazards
      WHERE (? IS NULL OR hazard_type IN (${(options.hazardTypes || []).map(() => '?').join(',') || 'NULL'}))
        AND (? IS NULL OR status = ?)
        AND (? = 1 OR status <> 'expired')
    `).all(
      options.hazardTypes?.length ? 1 : null,
      ...(options.hazardTypes || []),
      options.status || null,
      options.status || null,
      options.includeExpired ? 1 : 0
    );

    const offset = options.offset || 0;
    const end = options.limit === undefined ? undefined : offset + options.limit;

    return rows
      .map((row) => ({
        ...row,
        distance: haversineDistance(point, {
          latitude: row.latitude,
          longitude: row.longitude
        })
      }))
      .filter((row) => row.distance <= Math.max(radiusMeters, 0))
      .sort((left, right) => left.distance - right.distance)
      .slice(offset, end);
  };
}

export function createSqliteHazardDb(hazards = []) {
  const db = new Database(':memory:');
  createSchema(db);
  seedHazards(db, hazards);
  const getHazardsNearPoint = createHazardQuery(db);

  return {
    getHazardsNearPoint,
    countHazardsNearPoint(point, radiusMeters = 500, options = {}) {
      return getHazardsNearPoint(point, radiusMeters, options).length;
    },
    close() {
      db.close();
    }
  };
}
