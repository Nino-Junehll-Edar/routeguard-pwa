(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RGIcons = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var GLYPHS = {
    flood: '<path d="M3 10c2.2 0 2.2 1.6 4.5 1.6S9.8 10 12 10s2.2 1.6 4.5 1.6S18.8 10 21 10"/><path d="M3 15c2.2 0 2.2 1.6 4.5 1.6s2.3-1.6 4.5-1.6 2.2 1.6 4.5 1.6S18.8 15 21 15"/><path d="M3 20c2.2 0 2.2 1.6 4.5 1.6s2.3-1.6 4.5-1.6 2.2 1.6 4.5 1.6S18.8 20 21 20"/>',
    pothole: '<path d="M4 15a8 4.5 0 1 0 16 0 8 4.5 0 1 0-16 0"/><path d="m11 5-1.5 3 2.5 1.5"/>',
    accident: '<path d="M4 16v-3l2-4.5A2 2 0 0 1 7.8 7h8.4a2 2 0 0 1 1.8 1.5L20 13v3"/><path d="M4 13h16M7 16v2.5M17 16v2.5M2.5 16h19"/>',
    obstruction: '<path d="M12 4 5 20h14L12 4Z"/><path d="M9.3 13.5h5.4M8 17h8"/>',
    landslide: '<path d="M4 20h16M4 5l7 5"/><circle cx="9" cy="14" r="1.7"/><circle cx="14" cy="16.5" r="2"/><circle cx="17.5" cy="10.5" r="2.3"/>',
    tree: '<path d="M12 3 7 11h3l-4 6h12l-4-6h3L12 3Z"/><path d="M12 17v4"/>',
    collapse: '<path d="M8 3l3 5-4 3 5 4-3 6"/><path d="m14 4 2 3M15 12l3 2"/>',
    other: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    'shield-check': '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z"/><path d="m9 11.5 2 2 4-4.5"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    pin: '<path d="M12 21s-7-5.4-7-11a7 7 0 0 1 14 0c0 5.6-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    locate: '<circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.5-4.5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5 7-5s7 1.5 7 5"/><circle cx="17" cy="9" r="2.5"/><path d="M19.5 15.5c1.7.7 2.5 2 2.5 4.5"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>',
    gauge: '<circle cx="12" cy="12" r="10"/><path d="m12 12 4-4"/>',
    scroll: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 11s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    turn: '<path d="M9 20V9a4 4 0 0 1 4-4h5"/><path d="m15 2 3 3-3 3"/>',
    route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h1"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>'
  };

  var COLOR = {
    sev: { impassable: 'var(--danger, #C4271E)', one_lane: 'var(--warning, #B45309)', passable: 'var(--caution, #F0A400)' },
    cleared: 'var(--success, #2E8555)', expired: 'var(--neutral, #64748B)', neutral: 'var(--neutral, #64748B)',
    verifiedBg: 'var(--primary-ink, #0F3460)', advisory: 'var(--advisory, #6D28D9)', route: 'var(--route, #1D66C9)',
    primary: 'var(--primary, #1B5CA8)', surface: 'var(--surface, #FFFFFF)', danger: 'var(--danger, #C4271E)'
  };

  var CSS =
    '.rg-pin{position:relative;width:36px;height:36px;filter:drop-shadow(0 1px 2px rgba(10,20,30,.3))}' +
    '.rg-dot{position:absolute;inset:2px;border-radius:50%;background:var(--rg-c,#64748B);border:2.5px solid var(--surface,#FFFFFF);display:grid;place-items:center}' +
    '.rg-dot svg{width:16px;height:16px;display:block}' +
    '.rg-pin--dashed .rg-dot{border-style:dashed}.rg-pin--cleared{opacity:.55}.rg-pin--expired{opacity:.45}' +
    '.rg-badge{position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;background:var(--primary-ink,#0F3460);border:2px solid var(--surface,#FFFFFF);display:grid;place-items:center}' +
    '.rg-badge svg{width:9px;height:9px;display:block}' +
    '.rg-clock{position:absolute;right:-4px;top:-4px;width:16px;height:16px;border-radius:50%;background:var(--surface,#FFFFFF);border:1.5px solid var(--border,#DDE3EA);display:grid;place-items:center;color:var(--ink2,#4A545E)}' +
    '.rg-clock svg{width:9px;height:9px;display:block}' +
    '.rg-pin--sel::after{content:"";position:absolute;inset:-7px;border-radius:50%;border:3px solid var(--primary,#1B5CA8);animation:rg-pulse 1.5s cubic-bezier(.32,.72,.24,1) infinite}' +
    '@keyframes rg-pulse{0%{transform:scale(.8);opacity:.9}100%{transform:scale(1.3);opacity:0}}' +
    '.rg-cluster{width:40px;height:40px;border-radius:50%;background:var(--primary,#1B5CA8);color:#fff;font:700 13px/34px "Public Sans",system-ui,sans-serif;text-align:center;border:3px solid var(--surface,#FFFFFF);box-shadow:0 2px 8px rgba(10,20,30,.25);box-sizing:border-box}' +
    '.rg-udot{width:16px;height:16px;border-radius:50%;background:var(--route,#1D66C9);border:3px solid var(--surface,#FFFFFF);box-shadow:0 1px 2px rgba(10,20,30,.12)}' +
    '.rg-rpin{width:20px;height:20px;border-radius:50%;background:var(--danger,#C4271E);border:3px solid var(--surface,#FFFFFF);box-shadow:0 1px 2px rgba(10,20,30,.2);position:relative}' +
    '.rg-rpin::after{content:"";position:absolute;inset:-8px;border-radius:50%;background:var(--danger,#C4271E);opacity:.18}' +
    '.rg-advisory-point{display:grid;width:30px;height:30px;place-items:center;border:2.5px solid var(--surface,#FFFFFF);border-radius:50%;background:var(--advisory,#6D28D9);color:#fff;box-shadow:0 1px 3px rgba(10,20,30,.3)}' +
    '.rg-adv-tip{background:var(--advisory,#6D28D9);color:#fff;border:none;border-radius:999px;font:700 10px "Public Sans",system-ui,sans-serif;padding:3px 9px;box-shadow:none}.rg-adv-tip::before{display:none}' +
    '@media(prefers-reduced-motion:reduce){.rg-pin--sel::after{animation-duration:.01ms}}';

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('rg-icons-css')) return;
    var style = document.createElement('style');
    style.id = 'rg-icons-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  if (typeof document !== 'undefined') injectStyles();

  function glyph(name, options) {
    options = options || {};
    var body = GLYPHS[name] || GLYPHS.other;
    return '<svg width="' + (options.size || 16) + '" height="' + (options.size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="' + (options.stroke || '#FFFFFF') + '" stroke-width="' + (options.width || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  function pinHtml(options) {
    options = options || {};
    var severity = options.severity || 'one_lane';
    var verified = !!options.verified;
    var confirmed = options.confirmed || 0;
    var cleared = !!options.cleared;
    var expired = !!options.expired;
    var selected = !!options.selected;
    var color = cleared ? COLOR.cleared : expired ? COLOR.expired : (COLOR.sev[severity] || COLOR.neutral);
    var classes = 'rg-pin' + (!verified && confirmed < 2 ? ' rg-pin--dashed' : '') +
      (cleared ? ' rg-pin--cleared' : '') + (expired ? ' rg-pin--expired' : '') + (selected ? ' rg-pin--sel' : '');
    return '<div class="' + classes + '" style="--rg-c:' + color + '"><span class="rg-dot">' +
      glyph(options.tag || options.hazardType || 'other', { size: 16 }) + '</span>' +
      (verified ? '<span class="rg-badge">' + glyph('shield-check', { size: 9, width: 3 }) + '</span>' : '') +
      (options.queued ? '<span class="rg-clock">' + glyph('clock', { size: 9, stroke: 'currentColor' }) + '</span>' : '') + '</div>';
  }

  function pinOptsFromHazard(hazard) {
    return {
      tag: hazard.hazard_type,
      severity: hazard.severity || 'one_lane',
      verified: !!hazard.verified_by || hazard.verified === true,
      confirmed: hazard.confirmations_count || hazard.confirmed || 0,
      queued: !!hazard._queued,
      cleared: hazard.status === 'hazard_cleared',
      expired: hazard.status === 'expired',
      selected: !!hazard._selected
    };
  }

  function leafletOrThrow(L, name) {
    L = L || (typeof window !== 'undefined' ? window.L : null);
    if (!L) throw new Error('RGIcons.' + name + ': Leaflet not found; pass Leaflet as the second argument');
    return L;
  }
  function pinIcon(options, L) {
    L = leafletOrThrow(L, 'pinIcon');
    return L.divIcon({ className: '', html: pinHtml(options), iconSize: [36, 36], iconAnchor: [18, 18] });
  }
  function clusterHtml(count) { return '<div class="rg-cluster">' + count + '</div>'; }
  function clusterIcon(count, L) {
    L = leafletOrThrow(L, 'clusterIcon');
    return L.divIcon({ className: '', html: clusterHtml(count), iconSize: [40, 40], iconAnchor: [20, 20] });
  }
  function userDotHtml() { return '<div class="rg-udot"></div>'; }
  function userDotIcon(L) {
    L = leafletOrThrow(L, 'userDotIcon');
    return L.divIcon({ className: '', html: userDotHtml(), iconSize: [16, 16], iconAnchor: [8, 8] });
  }
  function placementHtml() { return '<div class="rg-rpin"></div>'; }
  function placementIcon(L) {
    L = leafletOrThrow(L, 'placementIcon');
    return L.divIcon({ className: '', html: placementHtml(), iconSize: [20, 20], iconAnchor: [10, 10] });
  }
  function advisoryLine(type) {
    return { color: COLOR.advisory, weight: type === 'road_closure' ? 8 : 6, opacity: 0.95, dashArray: type === 'roadwork' ? '11 8' : undefined };
  }
  function advisoryArea() { return { color: COLOR.advisory, weight: 2, fillOpacity: 0.15 }; }
  function advisoryTooltip() { return { permanent: true, direction: 'center', className: 'rg-adv-tip' }; }
  function routeCasing() { return { color: COLOR.surface, weight: 12, opacity: 0.9 }; }
  function routeLine() { return { color: COLOR.route, weight: 8 }; }

  return {
    version: '1.0', glyphNames: Object.keys(GLYPHS), glyph: glyph, colors: COLOR, styles: injectStyles,
    pinHtml: pinHtml, pinIcon: pinIcon, pinOptsFromHazard: pinOptsFromHazard,
    clusterHtml: clusterHtml, clusterIcon: clusterIcon, userDotHtml: userDotHtml, userDotIcon: userDotIcon,
    placementHtml: placementHtml, placementIcon: placementIcon,
    advisory: { line: advisoryLine, area: advisoryArea, tooltip: advisoryTooltip },
    route: { casing: routeCasing, line: routeLine }
  };
});
