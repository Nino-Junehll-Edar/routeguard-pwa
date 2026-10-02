import type * as Leaflet from 'leaflet';
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import type { Hazard } from '$lib/types/hazard';
import type { AgencyAdvisory } from '$lib/types/hazard';
import type { RouteResult } from '$lib/types/routing';
import { normalizeHazardLocation } from './geoUtils';
import { supabase } from './supabaseClient';
import './routeguard-icons.js';

let leaflet: typeof import('leaflet') | null = null;
let map: Leaflet.Map | null = null;
let hazardLayer: Leaflet.LayerGroup | null = null;
let advisoryLayer: Leaflet.LayerGroup | null = null;
let realtimeSubscriptionId = 0;
let hazardRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let advisoryRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
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
    title: `${hazard.hazard_type} - ${hazard.status}`,
    icon: RGIcons.pinIcon({
      tag: hazard.hazard_type,
      severity: hazard.severity,
      verified: hazard.status === 'hazard_active',
      cleared: hazard.status === 'hazard_cleared',
      expired: hazard.status === 'expired',
      selected: selectedHazardId === hazard.id
    }, L)
  });

  const escapedHazardType = escapeHtml(hazard.hazard_type);
  const escapedStatus = escapeHtml(hazard.status.replace('_', ' '));
  const safePhotoUrl = hazard.photo_url ? sanitizeUrl(hazard.photo_url) : '';
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
      title: 'Your Location',
      icon: RGIcons.userDotIcon(L)
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
export function addAdvisoryMarker(advisory: AgencyAdvisory): Leaflet.Layer | null {
  const L = leaflet;
  if (!L || !map || !advisoryLayer) return null;

  if (advisory.geometry && typeof advisory.geometry === 'object' && 'type' in advisory.geometry && advisory.geometry.type !== 'Point') {
    const style = advisory.geometry.type === 'Polygon'
      ? RGIcons.advisory.area()
      : RGIcons.advisory.line(advisory.advisory_type);
    const geometryLayer = L.geoJSON(advisory.geometry as GeoJSON.Geometry, {
      style,
      onEachFeature: (_feature, featureLayer) => {
        featureLayer.bindTooltip(escapeHtml(advisory.title), RGIcons.advisory.tooltip(advisory.title));
        featureLayer.bindPopup(`<strong>${escapeHtml(advisory.title)}</strong><br>${escapeHtml(advisory.advisory_type)}`);
      }
    });
    geometryLayer.addTo(advisoryLayer);
    return geometryLayer.getLayers()[0] ?? null;
  }

  // Handle point geometry
  let latLng: [number, number] | null = null;

  if (advisory.geometry) {
    const geom = advisory.geometry;
    if (geom && geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
      const [lng, lat] = geom.coordinates as [number, number];
      latLng = [lat, lng];
    }
  }

  if (!latLng) return null;

  const marker = L.marker(latLng, {
    title: `${advisory.title} - ${advisory.advisory_type}`,
    icon: L.divIcon({
      className: '',
      html: `<span class="rg-advisory-point">${RGIcons.glyph('flag', { size: 15 })}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
  });

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
  if (hazardRealtimeChannel) void supabase.removeChannel(hazardRealtimeChannel);
  hazardRealtimeChannel = supabase
    .channel(`map-utils-hazards-${++realtimeSubscriptionId}`)
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
  if (advisoryRealtimeChannel) void supabase.removeChannel(advisoryRealtimeChannel);
  advisoryRealtimeChannel = supabase
    .channel(`map-utils-advisories-${++realtimeSubscriptionId}`)
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
  L.polyline(latLngs, RGIcons.route.casing()).addTo(routeLayer);
  L.polyline(latLngs, { ...RGIcons.route.line(), color: getRouteColor(route.hazardScore) }).addTo(routeLayer);

  // Add start and end markers
  L.circleMarker(latLngs[0], { radius: 7, color: '#fff', weight: 2, fillColor: 'var(--success)', fillOpacity: 1 }).addTo(routeLayer);
  L.circleMarker(latLngs[latLngs.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: 'var(--danger)', fillOpacity: 1 }).addTo(routeLayer);

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