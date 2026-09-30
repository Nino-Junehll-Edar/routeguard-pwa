// Offline map tile caching for RouteGuard PWA
// Implements caching of map tiles for offline use with Leaflet

let mapTileCache = null;

/**
 * Initialize the map tile cache
 * Should be called after the Leaflet map is initialized
 * @param {L.Map} map - Leaflet map instance
 * @param {Object} options - Cache options
 * @returns {Object} - Tile cache instance
 */
export function initMapTileCache(map, options = {}) {
  // Default options
  const defaultOptions = {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    maxSize: 50 * 1024 * 1024, // 50 MB
    cleanupPeriod: 1000 * 60 * 60, // 1 hour
    ...options
  };

  // Create cache object
  mapTileCache = {
    map: map,
    options: defaultOptions,
    tiles: new Map(), // In-memory cache of tile data
    size: 0, // Current cache size in bytes
    lastCleanup: Date.now(),

    // Add tile to cache
    addTile: function(tileKey, tileData, contentType = 'image/png') {
      // Check if we need to cleanup first
      if (Date.now() - this.lastCleanup > this.options.cleanupPeriod) {
        this.cleanup();
      }

      // Calculate tile size
      const tileSize = tileData.byteLength || tileData.length || 0;

      // Check if adding this tile would exceed max size
      if (this.size + tileSize > this.options.maxSize) {
        // Cleanup to make space
        this.cleanup(this.options.maxSize - tileSize);
      }

      // Add tile to cache
      const cacheEntry = {
        data: tileData,
        contentType: contentType,
        timestamp: Date.now(),
        size: tileSize
      };

      this.tiles.set(tileKey, cacheEntry);
      this.size += tileSize;

      return true;
    },

    // Get tile from cache
    getTile: function(tileKey) {
      const entry = this.tiles.get(tileKey);
      if (!entry) {
        return null;
      }

      // Check if tile has expired
      if (Date.now() - entry.timestamp > this.options.maxAge) {
        this.removeTile(tileKey);
        return null;
      }

      return entry;
    },

    // Remove tile from cache
    removeTile: function(tileKey) {
      const entry = this.tiles.get(tileKey);
      if (entry) {
        this.size -= entry.size;
        this.tiles.delete(tileKey);
        return true;
      }
      return false;
    },

    // Cleanup old tiles
    cleanup: function(minSizeToKeep = 0) {
      const now = Date.now();
      const maxAge = this.options.maxAge;
      let freedSize = 0;

      // First, remove expired tiles
      for (const [tileKey, entry] of this.tiles.entries()) {
        if (now - entry.timestamp > maxAge) {
          this.size -= entry.size;
          this.tiles.delete(tileKey);
          freedSize += entry.size;
        }
      }

      // If still over size limit, remove oldest tiles
      if (this.size > this.options.maxSize && this.size > minSizeToKeep) {
        // Convert to array and sort by timestamp (oldest first)
        const tilesArray = Array.from(this.tiles.entries())
          .sort(([, a], [, b]) => a.timestamp - b.timestamp);

        // Remove tiles until we're under the limit
        for (const [tileKey, entry] of tilesArray) {
          if (this.size <= Math.max(this.options.maxSize, minSizeToKeep)) {
            break;
          }

          this.size -= entry.size;
          this.tiles.delete(tileKey);
          freedSize += entry.size;
        }
      }

      this.lastCleanup = now;
      return freedSize;
    },

    // Get cache statistics
    getStats: function() {
      return {
        tileCount: this.tiles.size,
        size: this.size,
        maxSize: this.options.maxSize,
        usagePercent: (this.size / this.options.maxSize) * 100
      };
    },

    // Clear all cached tiles
    clear: function() {
      this.tiles.clear();
      this.size = 0;
      this.lastCleanup = Date.now();
    }
  };

  // Override the tile layer's tile loading to use cache
  const originalCreateTile = mapTileCache.map._layers[Object.keys(mapTileCache.map._layers)[0]]?.createTile;
  if (originalCreateTile) {
    mapTileCache.map._layers[Object.keys(mapTileCache.map._layers)[0]].createTile = function(coords, done) {
      const tileKey = `${this._url}:${coords.z}:${coords.x}:${coords.y}`;

      // Try to get tile from cache first
      const cachedTile = mapTileCache.getTile(tileKey);
      if (cachedTile) {
        // Create image from cached data
        const img = new Image();
        img.onload = () => done(null, img);
        img.onerror = () => done(new Error('Failed to load cached tile'), null);

        // Create blob URL from cached data
        const blob = new Blob([cachedTile.data], { type: cachedTile.contentType });
        img.src = URL.createObjectURL(blob);

        // Clean up blob URL when image loads or errors
        img.onload = () => {
          URL.revokeObjectURL(img.src);
          done(null, img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(img.src);
          done(new Error('Failed to load cached tile'), null);
        };

        return img;
      }

      // If not in cache, load normally and cache the result
      const tile = originalCreateTile.call(this, coords, (err, image) => {
        if (err) {
          done(err, image);
          return;
        }

        // Convert image to blob for caching
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const arrayBuffer = reader.result;
              mapTileCache.addTile(tileKey, arrayBuffer, blob.type);
            };
            reader.readAsArrayBuffer(blob);
          }
          done(err, image);
        }, 'image/png');
      });

      return tile;
    };
  }

  return mapTileCache;
}

/**
 * Preload map tiles for a given bounding box and zoom levels
 * @param {Object} bounds - { north, south, east, west } in latitude/longitude
 * @param {number} minZoom - Minimum zoom level to cache
 * @param {number} maxZoom - Maximum zoom level to cache
 * @param {Function} progressCallback - Callback for progress updates
 */
export async function preloadMapTiles(bounds, minZoom, maxZoom, progressCallback) {
  if (!mapTileCache) {
    console.warn('Map tile cache not initialized');
    return;
  }

  const tilesToCache = [];

  // Calculate tiles needed for each zoom level
  for (let z = minZoom; z <= maxZoom; z++) {
    const tileRange = getTileRange(bounds, z);
    for (let x = tileRange.minX; x <= tileRange.maxX; x++) {
      for (let y = tileRange.minY; y <= tileRange.maxY; y++) {
        tilesToCache.push({ z, x, y });
      }
    }
  }

  // Load tiles with progress reporting
  let loaded = 0;
  for (const tile of tilesToCache) {
    try {
      const tileUrl = getTileUrl(tile.z, tile.x, tile.y);
      const response = await fetch(tileUrl);

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const tileKey = `${tileUrl}:${tile.z}:${tile.x}:${tile.y}`;
        mapTileCache.addTile(tileKey, arrayBuffer, response.headers.get('Content-Type') || 'image/png');
      }
    } catch (error) {
      console.warn(`Failed to preload tile ${tile.z}/${tile.x}/${tile.y}:`, error);
    }

    loaded++;
    if (progressCallback) {
      progressCallback(loaded, tilesToCache.length);
    }
  }
}

/**
 * Get tile range for a bounding box at a specific zoom level
 * @param {Object} bounds - { north, south, east, west } in latitude/longitude
 * @param {number} zoom - Zoom level
 * @returns {Object} - { minX, maxX, minY, maxY }
 */
function getTileRange(bounds, zoom) {
  const { north, south, east, west } = bounds;

  // Convert lat/lng to tile coordinates
  const latToY = (lat) => {
    const latRad = lat * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) * Math.pow(2, zoom));
  };

  const lngToX = (lng) => {
    return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  };

  const minX = lngToX(west);
  const maxX = lngToX(east);
  const minY = latToY(north); // Note: y decreases as latitude increases
  const maxY = latToY(south);

  return { minX, maxX, minY, maxY };
}

/**
 * Get tile URL for a given zoom/x/y coordinate
 * Assumes OpenStreetMap standard tile layer
 * @param {number} zoom - Zoom level
 * @param {number} x - Tile X coordinate
 * @param {number} y - Tile Y coordinate
 * @returns {string} - Tile URL
 */
function getTileUrl(zoom, x, y) {
  // Use the same tile layer as configured in mapUtils.js
  return `https://{s}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`
    .replace('{s}', 'a'); // Use subdomain 'a' for simplicity
}

/**
 * Export tiles as IndexedDB for persistent storage
 * This would integrate with the IndexedDB implementation
 */
export async function exportTilesToIndexedDB() {
  if (!mapTileCache) {
    console.warn('Map tile cache not initialized');
    return;
  }

  // This would store tiles in IndexedDB for persistent offline storage
  // Implementation would depend on the specific IDB schema
  console.log('Exporting tiles to IndexedDB - implementation pending');
}

/**
 * Import tiles from IndexedDB
 */
export async function importTilesFromIndexedDB() {
  if (!mapTileCache) {
    console.warn('Map tile cache not initialized');
    return;
  }

  // This would load tiles from IndexedDB into the memory cache
  console.log('Importing tiles from IndexedDB - implementation pending');
}