<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { user } from '$lib/authStore';
  import { profile } from '$lib/stores/profile';
  import { writable } from 'svelte/store';
  import { supabase } from '$lib/supabaseClient';
  import { filterAdvisories, type AdvisoryStateFilter } from '$lib/staffWorkflowUtils';
  import { saveAgencyAdvisory, setAgencyAdvisoryActive } from '$lib/agencyUtils';
  import Icon from '$lib/components/Icon.svelte';
  import { createAdvisoryGeometry } from '$lib/staffWorkflowUtils';
  import '$lib/routeguard-icons.js';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet-draw/dist/leaflet.draw.css';

  // Types
  interface Advisory {
    id: string;
    created_by: string;
    title: string;
    description: string | null;
    advisory_type: string;
    geometry: { type: string; coordinates: unknown } | null;
    start_time: string | null;
    end_time: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  interface AdvisoryForm {
    id?: string;
    title: string;
    advisoryType: string;
    description: string | null;
    geometry: { type: 'Point' | 'LineString' | 'Polygon'; coordinates: unknown } | null;
    startTime: string | null;
    endTime: string | null;
    isActive: boolean;
  }

  // Stores for data
  const advisories = writable<Advisory[]>([]);
  const loading = writable<boolean>(true);
  const error = writable<string | null>(null);
  const successMessage = writable<string | null>(null);

  // Form state
  const formMode = writable<'create' | 'edit'>('create');
  const formData = writable<AdvisoryForm>({
    title: '',
    advisoryType: '',
    description: null,
    geometry: null,
    startTime: null,
    endTime: null,
    isActive: true
  });

  // Editing state
  const editingAdvisoryId = writable<string | null>(null);

  // Filter state
  const searchTerm = writable<string>('');
  const advisoryTypeFilter = writable<string>('all');
  const stateFilter = writable<AdvisoryStateFilter>('all');

  // Map state
  let map: any = null;
  let leaflet: any = null;
  let drawnItems: any = null;
  let mapInitialized = false;
  let editorMinimized = false;

  // Check authorization
  async function checkAuthorization() {
    const currentUser = get(user);
    const profileData = get(profile);

    if (!currentUser) {
      // Not signed in, redirect to login
      goto('/login');
      return false;
    }

    // Wait for profile to load if not already loaded
    if (!profileData) {
      // Profile will be loaded via authStore listener, we'll check again in a moment
      // For now, we'll assume not authorized until profile loads
      return false;
    }

    // Check if user is agency personnel or admin
    if (profileData.role === 'agency_personnel' || profileData.role === 'admin') {
      return true;
    }

    // Not authorized, redirect to a safe default page
    goto('/map');
    return false;
  }

  // Load advisories
  async function loadAdvisories() {
    error.set(null);
    try {
      const { data, error: err } = await supabase
        .from('agency_advisories')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      advisories.set(data as Advisory[]);
    } catch (err) {
      console.error('Error loading advisories:', err);
      error.set('Could not load advisories. Try again.');
    } finally {
      loading.set(false);
    }
  }

  // Filter advisories
  let filteredAdvisories: Advisory[] = [];
  $: {
    const advisoriesList = get(advisories);
    const search = get(searchTerm).trim().toLowerCase();
    const type = get(advisoryTypeFilter);
    const state = get(stateFilter);
    filteredAdvisories = advisoriesList ? filterAdvisories(advisoriesList, search, type, state) : [];
  }

  // Initialize map for drawing
  async function initializeMap() {
    try {
      const L = await import('leaflet');
      await import('leaflet-draw');
      leaflet = L;

      const mapContainer = document.getElementById('advisory-map');
      if (!mapContainer) return;

      map = L.map(mapContainer, { zoomControl: false }).setView([11.2447, 125.0033], 13); // Default to Tacloban City

      // Add OSM tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Initialize drawing layer
      drawnItems = L.featureGroup().addTo(map);

      // Initialize draw control with a type-safe cast because leaflet-draw is not typed in this repo's Leaflet package.
      const drawControl = new (L as any).Control.Draw({
        edit: {
          featureGroup: drawnItems,
          remove: true
        },
        draw: {
          polygon: {
            allowIntersection: false,
            drawError: {
              color: '#e1e100',
              message: '<strong>Odd shape!<strong><br/>Allowed intersection of paths'
            },
            shapeOptions: {
              color: '#147D78'
            }
          },
          polyline: {
            shapeOptions: {
              color: '#147D78'
            }
          },
          marker: {
            icon: new L.DivIcon({
              className: '',
              html: `<span class="rg-advisory-point">${RGIcons.glyph('flag', { size: 15 })}</span>`,
              iconSize: [30, 40],
              iconAnchor: [15, 20]
            })
          },
          circle: false, // Disable circle - we only want point, line, polygon
          circlemarker: false
        }
      });

      map.addControl(drawControl);

      // Handle draw events
      map.on((L as any).Draw.Event.CREATED, (event: any) => {
        const layer = event.layer;
        drawnItems.addLayer(layer);
        updateFormGeometry(layer.toGeoJSON());
      });

      map.on((L as any).Draw.Event.EDITED, (event: any) => {
        const layers = event.layers;
        layers.eachLayer((layer: any) => {
          updateFormGeometry(layer.toGeoJSON());
        });
      });

      map.on((L as any).Draw.Event.DELETED, (event: any) => {
        const layers = event.layers;
        layers.eachLayer((layer: any) => {
          // If all layers are cleared, reset geometry
          if (drawnItems.getLayers().length === 0) {
            updateFormGeometry(null);
          }
        });
      });

      mapInitialized = true;

      // Load existing advisories on map if editing
      const editingId = get(editingAdvisoryId);
      if (editingId) {
        loadAdvisoryForEditing(editingId);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      error.set('Failed to initialize map. Try again.');
    }
  }

  // Update form geometry from drawn layer
  function updateFormGeometry(geojson: any) {
    if (!geojson) {
      formData.update(f => ({ ...f, geometry: null }));
      return;
    }

    const inputGeometry = geojson.type === 'Feature' ? geojson.geometry : geojson;
    if (!inputGeometry || !['Point', 'LineString', 'Polygon'].includes(inputGeometry.type)) {
      formData.update(f => ({ ...f, geometry: null }));
      return;
    }
    const type = inputGeometry.type as 'Point' | 'LineString' | 'Polygon';
    const geometry = createAdvisoryGeometry(type, inputGeometry.coordinates);

    formData.update(f => ({ ...f, geometry: geometry as AdvisoryForm['geometry'] }));
  }

  // Load advisory for editing
  async function loadAdvisoryForEditing(id: string) {
    try {
      const { data, error: err } = await supabase
        .from('agency_advisories')
        .select('*')
        .eq('id', id)
        .single();

      if (err) throw err;
      const advisory = data as Advisory;

      // Update form data
      formData.update(f => ({
        id: advisory.id,
        title: advisory.title,
        advisoryType: advisory.advisory_type,
        description: advisory.description,
        geometry: advisory.geometry ? {
          type: advisory.geometry.type as 'Point' | 'LineString' | 'Polygon',
          coordinates: advisory.geometry.coordinates
        } : null,
        startTime: advisory.start_time,
        endTime: advisory.end_time,
        isActive: advisory.is_active
      }));

      // Update editing state
      editingAdvisoryId.set(advisory.id);
      formMode.set('edit');

      // If we have geometry, add it to the map
      if (advisory.geometry && map && leaflet) {
        const geoJsonLayer = leaflet.geoJSON(advisory.geometry);
        drawnItems.clearLayers();
        drawnItems.addLayer(geoJsonLayer);
        map.fitBounds(geoJsonLayer.getBounds());
      }
    } catch (err) {
      console.error('Error loading advisory for editing:', err);
      error.set('Could not load advisory for editing.');
    }
  }

  // Clear form
  function clearForm() {
    formData.update(() => ({
      title: '',
      advisoryType: '',
      description: null,
      geometry: null,
      startTime: null,
      endTime: null,
      isActive: true
    }));

    editingAdvisoryId.set(null);
    formMode.set('create');

    // Clear map drawings
    if (drawnItems) {
      drawnItems.clearLayers();
    }

    // Reset map view
    if (map) {
      map.setView([11.2447, 125.0033], 13);
    }
  }

  // Save advisory
  async function saveAdvisory() {
    const data = get(formData);
    if (!data.title || !data.advisoryType) {
      error.set('Please fill in all required fields');
      return;
    }

    if (data.startTime && data.endTime && new Date(data.startTime) > new Date(data.endTime)) {
      error.set('End time must be after start time');
      return;
    }

    if (!data.geometry) {
      error.set('Please select a location on the map');
      return;
    }

    const geometry = data.geometry
      ? createAdvisoryGeometry(data.geometry.type, data.geometry.coordinates)
      : null;

    if (!geometry) {
      error.set('Please draw a valid point, line, or polygon on the map.');
      return;
    }

    try {
      error.set(null);
      successMessage.set(null);

      const result = await saveAgencyAdvisory({
        id: data.id ?? null,
        title: data.title,
        advisoryType: data.advisoryType,
        description: data.description,
        geometry: geometry,
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: data.isActive
      });

      if (!result.success) {
        throw new Error(result.error ?? 'Unknown save error');
      }

      successMessage.set(data.id ? 'Advisory updated successfully!' : 'Advisory created successfully!');
      clearForm();
      await loadAdvisories();
    } catch (err) {
      console.error('Error saving advisory:', err);
      error.set('Could not save advisory. Try again.');
    }
  }

  // Delete advisory
  async function deleteAdvisory(id: string) {
    if (!window.confirm('Are you sure you want to delete this advisory? This action cannot be undone.')) return;

    try {
      // Note: We don't have a delete function in agencyUtils yet, so we'll use supabase directly
      const { error: err } = await supabase
        .from('agency_advisories')
        .delete()
        .eq('id', id);

      if (err) throw err;

      // If we were editing this advisory, clear the form
      if (get(editingAdvisoryId) === id) {
        clearForm();
      }

      await loadAdvisories();
    } catch (err) {
      console.error('Error deleting advisory:', err);
      error.set('Could not delete advisory. Try again.');
    }
  }

  // Toggle advisory active state
  async function toggleAdvisoryActive(id: string, isActive: boolean) {
    try {
      const { error: err } = await setAgencyAdvisoryActive(id, !isActive);
      if (err) throw err;

      await loadAdvisories();
    } catch (err) {
      console.error('Error toggling advisory active state:', err);
      error.set('Could not update advisory. Try again.');
    }
  }

  // Format date for display
  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  }

  // Get advisory state badge class
  function getStateBadgeClass(advisory: Advisory): string {
    const now = Date.now();
    const startTime = advisory.start_time ? new Date(advisory.start_time).getTime() : Number.NEGATIVE_INFINITY;
    const endTime = advisory.end_time ? new Date(advisory.end_time).getTime() : Number.POSITIVE_INFINITY;

    if (endTime < now) return 'state-expired';
    if (startTime > now) return 'state-upcoming';
    return advisory.is_active ? 'state-active' : 'state-inactive';
  }

  // Get advisory state label
  function getStateLabel(advisory: Advisory): string {
    const now = Date.now();
    const startTime = advisory.start_time ? new Date(advisory.start_time).getTime() : Number.NEGATIVE_INFINITY;
    const endTime = advisory.end_time ? new Date(advisory.end_time).getTime() : Number.POSITIVE_INFINITY;

    if (endTime < now) return 'Expired';
    if (startTime > now) return 'Upcoming';
    return advisory.is_active ? 'Active' : 'Inactive';
  }

  // Format geometry for display
  function formatGeometry(geometry: any): string {
    if (!geometry) return 'No location selected';

    const type = geometry.type.toUpperCase();
    let coords = '';

    if (type === 'POINT') {
      const [lng, lat] = geometry.coordinates;
      coords = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    } else if (type === 'LINESTRING') {
      coords = `${geometry.coordinates.length} points`;
    } else if (type === 'POLYGON') {
      coords = `${geometry.coordinates.length} rings`;
    }

    return `${type}: ${coords}`;
  }

  // Page lifecycle
  onMount(async () => {
    const authorized = await checkAuthorization();
    if (!authorized) return;

    await loadAdvisories();
    await tick();
    await initializeMap();
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }
    leaflet = null;
    drawnItems = null;
    mapInitialized = false;
  });
</script>

<svelte:head>
  <title>Manage Advisories | RouteGuard</title>
</svelte:head>

{#if $loading}
  <div class="loading-overlay">
    <div class="loading-spinner"></div>
    <p>Loading advisories...</p>
  </div>
{:else if $error}
  <div class="error-banner">{$error}</div>
{:else}
  <div class="advisory-console">
    <header class="console-header">
      <div class="user-greeting">
        <h1>Good day, {$profile?.full_name || 'User'}</h1>
        <p class="console-subtitle">Create and manage official advisories for the community.</p>
        <span class="verified-badge">LGU verified account</span>
      </div>

      {#if $successMessage}
        <div class="feedback success">{$successMessage}</div>
      {/if}
    </header>

    <section class="advisory-manager">
      <div class="form-section">
        <div class="form-section-header">
          <h2>{$formMode === 'create' ? 'Create New Advisory' : 'Edit Advisory'}</h2>
          <div class="form-header-actions">
            {#if $formMode === 'edit'}
              <button type="button" class="quiet-button" on:click={clearForm}>Cancel</button>
            {/if}
            <button
              type="button"
              class="quiet-button"
              aria-controls="advisory-fields"
              aria-expanded={!editorMinimized}
              on:click={async () => {
                editorMinimized = !editorMinimized;
                if (!editorMinimized) {
                  await tick();
                  map?.invalidateSize();
                }
              }}
            >
              {editorMinimized ? 'Expand editor' : 'Minimize editor'}
            </button>
          </div>
        </div>

        <form on:submit|preventDefault={saveAdvisory}>
          <div id="advisory-fields" class="form-grid" class:editor-minimized={editorMinimized}>
            <div class="form-field full-width">
              <label>Title</label>
              <input
                type="text"
                bind:value={$formData.title}
                placeholder="Enter advisory title"
                required
              />
            </div>

            <div class="form-field full-width">
              <label>Advisory Type</label>
              <input
                type="text"
                bind:value={$formData.advisoryType}
                placeholder="e.g., Weather, Road Work, Emergency"
                required
              />
            </div>

            <div class="form-field full-width">
              <label>Description</label>
              <textarea
                bind:value={$formData.description}
                placeholder="Enter detailed description"
                rows="4"
              ></textarea>
            </div>

            <div class="form-field full-width">
              <label>Location</label>
              <div id="advisory-map" style="height: 300px; border: 1px solid var(--border); border-radius: var(--r-m); margin: 8px 0;"></div>
              <div class="map-help">
                Use the map tools to draw a point, line, or polygon to define the advisory area.
              </div>
              <div class="geometry-info">
                Selected: {formatGeometry($formData.geometry)}
              </div>
            </div>

            <div class="form-field">
              <label>Start Time</label>
              <input
                type="datetime-local"
                bind:value={$formData.startTime}
              />
            </div>

            <div class="form-field">
              <label>End Time</label>
              <input
                type="datetime-local"
                bind:value={$formData.endTime}
              />
            </div>

            <div class="form-field full-width">
              <label>Active Status</label>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  bind:checked={$formData.isActive}
                />
                <span>{$formData.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div class="form-field full-width">
              <button type="submit" class="active-button">
                {$formMode === 'create' ? 'Create Advisory' : 'Update Advisory'}
              </button>
              {#if $formMode === 'edit'}
                <button type="button" class="clear-button" on:click={clearForm}>
                  Cancel
                </button>
              {/if}
            </div>
          </div>
        </form>

      {#if $formMode === 'create'}
        <section class="advisory-list">
          <div class="list-header">
            <h2>Existing Advisories</h2>
            <div class="filters">
              <div class="filter-group">
                <label>Search:</label>
                <input
                  type="text"
                  bind:value={$searchTerm}
                  placeholder="Search advisories..."
                />
              </div>

              <div class="filter-group">
                <label>Type:</label>
                <select bind:value={$advisoryTypeFilter}>
                  <option value="all">All Types</option>
                  {#each [...new Set(get(advisories).map((advisory) => advisory.advisory_type).filter(Boolean))] as type}
                    <option value={type}>{type}</option>
                  {/each}
                </select>
              </div>

              <div class="filter-group">
                <label>State:</label>
                <select bind:value={$stateFilter}>
                  <option value="all">All States</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <button type="button" class="quiet-button" on:click={() => {
                searchTerm.set('');
                advisoryTypeFilter.set('all');
                stateFilter.set('all');
              }}>
                Clear Filters
              </button>
            </div>
          </div>

          {#if filteredAdvisories.length === 0}
            <div class="empty-state">No advisories match these filters.</div>
          {:else}
            <ul class="advisories-list">
              {#each filteredAdvisories as advisory (advisory.id)}
                <li class="advisory-item">
                  <div class="advisory-info">
                    <div class="advisory-title">{advisory.title}</div>
                    <div class="advisory-meta">
                      <span class="advisory-type">{advisory.advisory_type}</span>
                      <span class="advisory-window">
                        {#if advisory.start_time && advisory.end_time}
                          {new Date(advisory.start_time).toLocaleDateString()} – {new Date(advisory.end_time).toLocaleDateString()}
                        {:else if advisory.start_time}
                          From {new Date(advisory.start_time).toLocaleDateString()}
                        {:else if advisory.end_time}
                          Until {new Date(advisory.end_time).toLocaleDateString()}
                        {:else}
                          Open-ended
                        {/if}
                      </span>
                    </div>
                  </div>

                  <div class="advisory-details">
                    <div class="advisory-geometry">
                      <strong>Area:</strong> {formatGeometry(advisory.geometry)}
                    </div>
                    {#if advisory.description}
                      <div class="advisory-description">
                        <strong>Description:</strong> {advisory.description}
                      </div>
                    {/if}
                    <div class="advisory-timestamps">
                      <strong>Created:</strong> {formatDate(advisory.created_at)}
                      <strong>Updated:</strong> {formatDate(advisory.updated_at)}
                    </div>
                  </div>

                  <div class="advisory-actions">
                    <span class="state-badge {getStateBadgeClass(advisory)}">
                      {getStateLabel(advisory)}
                    </span>
                    <div class="action-buttons">
                      <button
                        type="button"
                        class="quiet-button"
                        on:click={() => {
                          editingAdvisoryId.set(advisory.id);
                          formMode.set('edit');
                          loadAdvisoryForEditing(advisory.id);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="clear-button"
                        on:click={() => deleteAdvisory(advisory.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        class="quiet-button"
                        on:click={() => toggleAdvisoryActive(advisory.id, advisory.is_active)}
                      >
                        {advisory.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
    </section>
  </div>
{/if}

<style>
  .advisory-console {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    background: var(--background);
    min-height: 100vh;
  }

  .console-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .user-greeting h1 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    color: var(--primary-ink);
  }

  .console-subtitle {
    margin: 0 0 12px 0;
    color: var(--ink2);
    font-size: 1rem;
  }

  .verified-badge {
    background: var(--primary-surface);
    color: var(--primary);
    padding: 4px 12px;
    border-radius: var(--r-s);
    font-size: 0.875rem;
    font-weight: 600;
    border: 1px solid var(--primary);
  }

  .feedback {
    padding: 12px;
    border-radius: var(--r-s);
    margin-bottom: 16px;
  }

  .feedback.success {
    background: var(--success-surface);
    color: var(--success);
  }

  .error-banner {
    background: var(--danger-surface);
    color: var(--danger);
    padding: 12px 16px;
    border-radius: var(--r-s);
    margin-bottom: 20px;
    font-size: 0.875rem;
  }

  .advisory-manager {
    display: grid;
    gap: 24px;
  }

  .form-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    overflow: hidden;
  }

  .form-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
  }

  .form-header-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .form-section h2 {
    margin: 0;
    padding: 10px 4px;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary-ink);
  }

  .form-grid {
    display: grid;
    gap: 16px;
    padding: 20px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .form-grid.editor-minimized { display: none; }

  .form-field.full-width {
    grid-column: 1 / -1;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-field label {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ink2);
  }

  .form-field input,
  .form-field textarea,
  .form-field select {
    width: 100%;
    min-height: 42px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--r-s);
    background: var(--surface);
    color: var(--ink);
    font-family: inherit;
    font-size: 0.875rem;
  }

  .form-field input:focus,
  .form-field textarea:focus,
  .form-field select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-surface);
  }

  .toggle-switch {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    user-select: none;
  }

  .toggle-switch input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .active-button {
    background: var(--primary);
    color: #fff;
    border: none;
    padding: 12px 24px;
    border-radius: var(--r-s);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .active-button:hover {
    background: var(--primary-dark);
  }

  .clear-button {
    border: 1px solid var(--border);
    color: var(--ink);
    background: transparent;
    padding: 12px 24px;
    border-radius: var(--r-s);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .clear-button:hover {
    background: var(--surface);
  }

  .quiet-button {
    border: 1px solid var(--border);
    color: var(--ink);
    background: transparent;
    padding: 8px 16px;
    border-radius: var(--r-s);
    font-weight: 600;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .quiet-button:hover {
    background: var(--surface);
  }

  .map-help {
    font-size: 0.875rem;
    color: var(--ink2);
    margin-bottom: 8px;
  }

  .geometry-info {
    font-size: 0.875rem;
    color: var(--ink2);
    font-family: var(--f);
    margin-top: 4px;
  }

  .advisory-list {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-m);
    overflow: hidden;
  }

  .advisory-list h2 {
    margin: 0;
    padding: 20px;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary-ink);
    border-bottom: 1px solid var(--border);
  }

  .filters {
    display: grid;
    gap: 12px;
    padding: 20px;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    border-bottom: 1px solid var(--border);
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-group label {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ink2);
  }

  .advisories-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .advisory-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .advisory-item:last-child {
    border-bottom: none;
  }

  .advisory-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .advisory-title {
    font-weight: 600;
    font-size: 1rem;
    color: var(--primary-ink);
  }

  .advisory-meta {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 0.875rem;
    color: var(--ink2);
    flex-wrap: wrap;
  }

  .advisory-type {
    text-transform: capitalize;
  }

  .advisory-window {
    font-family: var(--f);
  }

  .advisory-details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .advisory-geometry,
  .advisory-description,
  .advisory-timestamps {
    font-size: 0.875rem;
    color: var(--ink2);
  }

  .advisory-geometry,
  .advisory-description {
    margin-bottom: 4px;
  }

  .advisory-timestamps {
    display: flex;
    gap: 16px;
  }

  .advisory-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }

  .state-badge {
    padding: 4px 8px;
    border-radius: var(--r-s);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .state-badge.state-active {
    background: var(--danger-surface);
    color: var(--danger);
  }

  .state-badge.state-inactive {
    background: var(--surface);
    color: var(--ink2);
  }

  .state-badge.state-upcoming {
    background: var(--warning-surface);
    color: var(--warning);
  }

  .state-badge.state-expired {
    background: var(--surface);
    color: var(--ink2);
  }

  .action-buttons {
    display: flex;
    gap: 6px;
  }

  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255,255,255,0.9);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Dark mode */
  [data-theme=dark] .form-section,
  [data-theme=dark] .advisory-list {
    border-color: var(--border);
    background: var(--surface);
  }

  [data-theme=dark] .form-field input,
  [data-theme=dark] .form-field textarea,
  [data-theme=dark] .form-field select {
    background: var(--surface);
    border-color: var(--border);
    color: var(--ink);
  }

  [data-theme=dark] .advisory-item {
    border-color: var(--border);
    background: var(--surface);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .advisory-console {
      padding: 16px;
    }

    .console-header {
      flex-direction: column;
      align-items: stretch;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .filters {
      grid-template-columns: 1fr;
    }

    .advisory-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .advisory-actions {
      align-self: flex-start;
      margin-top: 12px;
    }
  }

  @media (max-width: 480px) {
    .form-section-header { align-items: flex-start; flex-direction: column; }
    .form-header-actions { justify-content: flex-start; }
  }
</style>