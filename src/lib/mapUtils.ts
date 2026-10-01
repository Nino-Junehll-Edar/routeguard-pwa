import type * as Leaflet from 'leaflet';
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import type { Hazard } from '$lib/types/hazard';
import type { AgencyAdvisory } from '$lib/types/hazard';
import type { RouteResult } from '$lib/types/routing';
import { normalizeHazardLocation } from './geoUtils';
import { supabase } from './supabaseClient';

let leaflet: typeof import('leaflet') | null = null;
let map: Leaflet.Map | null = null;
let hazardLayer: Leaflet.LayerGroup | null = null;
let advisoryLayer: Leaflet.LayerGroup | null = null;
let userMarker: Leaflet.Marker | null = null;
let accuracyCircle: Leaflet.Circle | null = null;
let routeLayer: Leaflet.LayerGroup | null = null;
let mapResizeObserver: ResizeObserver | null = null;

// Fixed XSS vulnerability in escapeHtml function - corrected HTML entity mappings - NOW WITH PROPER ESCAPING
// Update: Fixed XSS vulnerabilities per security review
/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (match) => escapeMap[match] ?? match);
}

/**
 * Sanitize URL to prevent XSS via malicious protocols
 */
function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Allow only http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }
    return urlObj.toString();
  } catch (e) {
    return '';
  }
}

/**
 * Initialize the map with OpenStreetMap tiles
 */
export async function initializeMap(containerId: string): Promise<Leaflet.Map> {
  const container = document.getElementById(containerId);
  if (!container) throw new Error(`Map container not found: ${containerId}`);

  if (map?.getContainer() === container) {
    requestAnimationFrame(() => map?.invalidateSize({ pan: false }));
    return map;
  }

  if (map) {
    mapResizeObserver?.disconnect();
    map.remove();
    map = null;
    hazardLayer = null;
    userMarker = null;
    accuracyCircle = null;
    routeLayer = null;
  }

  const L = leaflet ?? await import('leaflet');
  leaflet = L;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2xUrl,
    iconUrl: markerIconUrl,
    shadowUrl: markerShadowUrl
  });
  map = L.map(container).setView([11.2447, 125.0033], 13); // Default to Tacloban City

  // Add OSM tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Initialize hazard layer
  hazardLayer = L.layerGroup().addTo(map);

  // Initialize advisory layer
  advisoryLayer = L.layerGroup().addTo(map);

  // Initialize route layer
  routeLayer = L.layerGroup().addTo(map);

  if (typeof ResizeObserver !== 'undefined') {
    mapResizeObserver = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
    mapResizeObserver.observe(container);
  }
  requestAnimationFrame(() => map?.invalidateSize({ pan: false }));

  return map;
}

/**
 * Add a hazard marker to the map with full Z.AI pin styling
 */
export function addHazardMarker(
  hazard: Hazard,
  selectedHazardId: string | null,
  onSelect?: (hazard: Hazard) => void
): Leaflet.Marker | null {
  const L = leaflet;
  if (!L || !map || !hazardLayer) return null;

  const coordinates = normalizeHazardLocation(hazard.location);
  if (!coordinates) return null;
  const [lng, lat] = coordinates;
  const marker = L.marker([lat, lng], {
    title: `${hazard.hazard_type} - ${hazard.status}`
  });

  // Determine pin style based on hazard status
  const { pinColor, badgeColor, badgeText, pulseColor } = getHazardPinStyles(
    hazard.status,
    hazard.hazard_type,
    hazard.lifetime_minutes
  );

  // Create the full Z.AI style hazard pin
  const icon = L.divIcon({
    className: 'hazard-pin-wrapper',
    html: `
      <div class="hazard-pin" style="background-color: ${pinColor}; border-color: ${pinColor};">
        ${hazard.lifetime_minutes > 0 && hazard.lifetime_minutes < 60 ?
          `<div class="hazard-pin-badge" style="background-color: ${badgeColor};">${badgeText}</div>` : ''}
        <div class="hazard-pin-inner" style="border-color: ${pinColor};">
          <div class="hazard-pin-dot"></div>
        </div>
        ${hazard.lifetime_minutes > 0 ?
          `<div class="hazard-pin-query-bubble">${escapeHtml(hazard.hazard_type)}</div>` : ''}
      </div>
      ${selectedHazardId === hazard.id ?
        `<div class="selection-pulse" style="background-color: ${pulseColor || pinColor};"></div>` : ''}
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40]
  });

  marker.setIcon(icon);

  // Add popup with hazard info - escaped to prevent XSS
  const escapedHazardType = escapeHtml(hazard.hazard_type);
  const escapedStatus = escapeHtml(hazard.status.replace('_', ' '));
  const safePhotoUrl = hazard.photo_url ? sanitizeUrl(hazard.photo_url) : '';
  // Escape the URL for use in HTML attribute
  const escapedPhotoUrl = safePhotoUrl
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const photoUrlHtml = safePhotoUrl ? `<br/><img src="${escapedPhotoUrl}" style="max-width: 200px; border-radius: var(--r-m);">` : '';

  if (onSelect) {
    marker.on('click', () => onSelect(hazard));
  } else {
    marker.bindPopup(`
    <div class="hazard-popup-content">
      <div class="hazard-popup-type">${escapedHazardType}</div>
      <div class="hazard-popup-time">${new Date(hazard.created_at).toLocaleString()}</div>
      <div class="hazard-popup-status">Status: ${escapedStatus}</div>
      ${hazard.description ? `<div class="hazard-popup-description">${escapeHtml(hazard.description)}</div>` : ''}
      ${photoUrlHtml}
    </div>
    `, {
      className: 'hazard-popup',
      keepInView: true
    });
  }

  hazardLayer.addLayer(marker);
  return marker;
}

/**
 * Get hazard pin styles based on status and type
 */
function getHazardPinStyles(status: string, hazardType: string, lifetimeMinutes: number = 0): {
  pinColor: string;
  badgeColor: string;
  badgeText: string;
  pulseColor: string
} {
  // Base colors from design system
  const colors: Record<string, string> = {
    '--danger': 'var(--danger)',
    '--warning': 'var(--warning)',
    '--success': 'var(--success)',
    '--info': 'var(--info)',
    '--neutral': 'var(--neutral)',
    '--caution': 'var(--caution)'
  };

  let pinColor = colors['--neutral'];
  let badgeColor = colors['--primary'];
  let badgeText = '!?';
  let pulseColor = colors['--primary'];

  switch (status) {
    case 'impassable':
      pinColor = colors['--danger'];
      badgeColor = colors['--danger'];
      badgeText = '!';
      pulseColor = colors['--danger'];
      break;
    case 'one_lane':
      pinColor = colors['--warning'];
      badgeColor = colors['--warning'];
      badgeText = '1';
      pulseColor = colors['--warning'];
      break;
    case 'passable':
    case 'hazard_cleared':
      pinColor = colors['--success'];
      badgeColor = colors['--success'];
      badgeText = '✓';
      pulseColor = colors['--success'];
      break;
    case 'hazard_active':
      pinColor = colors['--danger'];
      badgeColor = colors['--danger'];
      badgeText = '!';
      pulseColor = colors['--danger'];
      break;
    case 'needs_verification':
      pinColor = colors['--warning'];
      badgeColor = colors['--warning'];
      badgeText = '!?';
      pulseColor = colors['--warning'];
      break;
    case 'unconfirmed':
    case 'expired':
    default:
      pinColor = colors['--info'];
      badgeColor = colors['--info'];
      badgeText = '?';
      pulseColor = colors['--info'];
  }

  // Adjust badge text based on hazard type for query bubble
  const typeMap: Record<string, string> = {
    'flood': '💧',
    'landslide': '⚠️',
    'road-damage': '🚧',
    'fallen-tree': '🌳',
    'accident': '💥',
    'construction': '🚧'
  };

  // For query bubble, use hazard type emoji or abbreviation
  if (lifetimeMinutes > 0) {
    badgeText = typeMap[hazardType] || (hazardType ? hazardType.substring(0, 1).toUpperCase() : '?');
  }

  return { pinColor, badgeColor, badgeText, pulseColor };
}

/**
 * Update user location on map
 */
export function updateUserPosition(latitude: number, longitude: number, accuracy: number = 0): void {
  const L = leaflet;
  if (!L || !map) return;

  // Update or create user marker
  if (userMarker) {
    userMarker.setLatLng([latitude, longitude]);
  } else {
    userMarker = L.marker([latitude, longitude], {
      title: 'Your Location'
    }).addTo(map);

    // Add accuracy circle
    if (accuracy > 0) {
      accuracyCircle = L.circle([latitude, longitude], {
        radius: accuracy,
        color: 'var(--primary)',
        fillColor: 'var(--primary)',
        fillOpacity: 0.2
      }).addTo(map);
    }
  }

  // Center map on user location (optional, based on preference)
  // map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
}

/**
 * Clear all hazard markers
 */
export function clearHazardMarkers(): void {
  if (hazardLayer) {
    hazardLayer.clearLayers();
  }
}

/**
 * Load and display hazards from Supabase
 * @param selectedHazardId ID of hazard to highlight (optional)
 * @param filters Optional filters to apply (status, etc.)
 */
export async function loadHazards(
  selectedHazardId: string | null,
  filters: { status?: string } = {},
  onSelect?: (hazard: Hazard) => void
): Promise<void> {
  if (!map || !hazardLayer) return;

  clearHazardMarkers();

  let query = supabase
    .from('hazards')
    .select('*')
    .not('status', 'eq', 'expired') // Don't show expired hazards
    .order('created_at', { ascending: false });

  // Apply status filter if provided
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading hazards:', error);
    return;
  }

  (data as Hazard[]).forEach(hazard => {
    addHazardMarker(hazard, selectedHazardId, onSelect);
  });
}

/**
 * Load and display active advisories from Supabase
 */
export async function loadAdvisories(): Promise<void> {
  if (!map || !advisoryLayer) return;

  clearAdvisoryMarkers();

  const { data, error } = await supabase
    .from('agency_advisories')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading advisories:', error);
    return;
  }

  (data as AgencyAdvisory[]).forEach(advisory => {
        addAdvisoryMarker(advisory);
  });
}

/**
 * Clear all advisory markers
 */
export function clearAdvisoryMarkers(): void {
  if (advisoryLayer) {
    advisoryLayer.clearLayers();
  }
}

/**
 * Add an advisory marker to the map
 */
export function addAdvisoryMarker(advisory: AgencyAdvisory): Leaflet.Marker | null {
  const L = leaflet;
  if (!L || !map || !advisoryLayer) return null;

  // Handle different geometry types
  let latLngs: Array<[number, number]> = [];

  if (advisory.geometry) {
    // For now, we'll handle Point geometries
    // In a full implementation, you'd handle LineString, Polygon, etc.
        const geom = advisory.geometry;
    if (geom && geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
      const [lng, lat] = geom.coordinates as [number, number];
      latLngs = [[lat, lng]];
    }
    // Could add support for LineString, Polygon here
  }

  if (latLngs.length === 0) return null;

  // For simplicity, we'll just use the first point for Point geometries
  // For lines/polygons, we'd use polyline/polygon
  const [lat, lng] = latLngs[0];
  const marker = L.marker([lat, lng], {
    title: `${advisory.title} - ${advisory.advisory_type}`
  });

  // Create advisory icon
  const icon = L.divIcon({
    className: 'advisory-pin-wrapper',
    html: `
      <div class="advisory-pin" style="background-color: var(--info); border-color: var(--info);">
        <div class="advisory-pin-inner" style="border-color: var(--info);">
          <div class="advisory-pin-dot"></div>
        </div>
        <div class="advisory-pin-query-bubble">${escapeHtml(advisory.advisory_type)}</div>
      </div>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40]
  });

  marker.setIcon(icon);

  // Add popup with advisory info
  const escapedTitle = escapeHtml(advisory.title);
  const escapedType = escapeHtml(advisory.advisory_type);
  const escapedDescription = advisory.description ? escapeHtml(advisory.description) : '';

  marker.bindPopup(`
    <div class="advisory-popup-content">
      <div class="advisory-popup-title">${escapedTitle}</div>
      <div class="advisory-popup-type">${escapedType}</div>
      ${advisory.description ? `<div class="advisory-popup-description">${escapedDescription}</div>` : ''}
      ${advisory.start_time ? `<div class="advisory-popup-time">Starts: ${new Date(advisory.start_time).toLocaleString()}</div>` : ''}
      ${advisory.end_time ? `<div class="advisory-popup-time">Ends: ${new Date(advisory.end_time).toLocaleString()}</div>` : ''}
    </div>
  `, {
    className: 'advisory-popup',
    keepInView: true
  });

  advisoryLayer.addLayer(marker);
  return marker;
}

/**
 * Subscribe to real-time hazard updates
 */
export function subscribeToHazardChanges(
  onHazardsUpdated?: () => void,
  onVerificationNeeded?: (hazard: any) => void,
  onHazardSelected?: (hazard: Hazard) => void
): void {
  supabase
    .channel('hazards-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'hazards' },
      (payload) => {
        loadHazards(null, {}, onHazardSelected);
        if (onHazardsUpdated) {
          onHazardsUpdated();
        }

        // Check if this update is for a hazard that now needs verification
        if (payload.new && 'status' in payload.new && payload.new.status === 'needs_verification' && onVerificationNeeded) {
          onVerificationNeeded(payload.new);
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to real-time advisory updates
 */
export function subscribeToAdvisoryChanges(onAdvisoriesUpdated?: () => void): void {
  supabase
    .channel('advisory-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'agency_advisories' },
      (payload) => {
        loadAdvisories(); // Reload advisories on change
        if (onAdvisoriesUpdated) {
          onAdvisoriesUpdated();
        }
      }
    )
    .subscribe();
}

/**
 * Display a route on the map
 */
export function displayRoute(route: RouteResult): void {
  const L = leaflet;
  if (!L || !map || !routeLayer || !route || route.points.length === 0) return;

  // Clear existing route
  clearRoute();

  // Create polyline points
  const latLngs: Array<[number, number]> = route.points.map((point) => [point.lat, point.lng]);

  // Create polyline with hazard-aware coloring
  L.polyline(latLngs, {
    color: getRouteColor(route.hazardScore),
    weight: 6,
    opacity: 0.8,
    smoothFactor: 1
  }).addTo(routeLayer);

  // Add start and end markers
  L.marker([route.points[0].lat, route.points[0].lng], {
    title: 'Start',
    icon: L.divIcon({
      className: 'start-marker',
      html: '<div style="background-color: var(--success); width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--surface);"></div>',
      iconSize: [16, 16]
    })
  }).addTo(routeLayer);

  L.marker([route.points[route.points.length - 1].lat, route.points[route.points.length - 1].lng], {
    title: 'End',
    icon: L.divIcon({
      className: 'end-marker',
      html: '<div style="background-color: var(--danger); width: 16px; height: 16px; border-radius: 2px solid var(--surface);"></div>',
      iconSize: [16, 16]
    })
  }).addTo(routeLayer);

  // Fit map to show the entire route
  const bounds = L.latLngBounds(latLngs);
  map.fitBounds(bounds, { padding: [50, 50] });
}

/**
 * Get route color based on hazard score (green to red gradient)
 */
function getRouteColor(hazardScore: number): string {
  const safeScore = Math.min(100, Math.max(0, hazardScore));
  const hue = Math.round(120 * (1 - safeScore / 100));
  return `hsl(${hue}, 80%, 40%)`;
}

/**
 * Clear the route from the map
 */
export function clearRoute(): void {
  if (routeLayer) {
    routeLayer.clearLayers();
  }
}