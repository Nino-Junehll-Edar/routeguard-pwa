import type * as Leaflet from 'leaflet';

declare namespace RGIcons {
  type Severity = 'passable' | 'one_lane' | 'impassable';
  type HazardStatus = 'unconfirmed' | 'needs_verification' | 'hazard_active' | 'hazard_cleared' | 'expired';
  type AdvisoryType = 'road_closure' | 'roadwork' | 'flood_zone' | 'event';
  type HazardTag = 'flood' | 'pothole' | 'accident' | 'obstruction' | 'landslide' | 'tree' | 'collapse' | 'other' | (string & {});
  type GlyphName = HazardTag | 'shield-check' | 'shield' | 'clock' | 'pin' | 'locate' | 'warn' | 'camera' | 'check' | 'x' | 'plus' | 'search' | 'bell' | 'map' | 'compass' | 'user' | 'users' | 'flag' | 'gauge' | 'scroll' | 'bolt' | 'layers' | 'logout' | 'eye' | 'eye-off' | 'download' | 'turn' | 'route' | 'send' | 'back' | 'chevron';
  interface GlyphOptions { size?: number; width?: number; stroke?: string; }
  interface PinOptions { tag?: HazardTag; hazardType?: HazardTag; severity?: Severity; verified?: boolean; confirmed?: number; queued?: boolean; cleared?: boolean; expired?: boolean; selected?: boolean; }
  interface HazardLike { hazard_type?: string; severity?: Severity | string; verified_by?: string | null; verified?: boolean; confirmations_count?: number; confirmed?: number; _queued?: boolean; status?: HazardStatus | string; _selected?: boolean; [key: string]: unknown; }
  interface Colors { sev: Record<Severity, string>; cleared: string; expired: string; neutral: string; verifiedBg: string; advisory: string; route: string; primary: string; surface: string; danger: string; }
  interface API {
    version: string;
    glyphNames: string[];
    glyph(name: GlyphName, options?: GlyphOptions): string;
    colors: Colors;
    styles(): void;
    pinHtml(options?: PinOptions): string;
    pinIcon(options?: PinOptions, L?: typeof Leaflet): Leaflet.DivIcon;
    pinOptsFromHazard(hazard: HazardLike): PinOptions;
    clusterHtml(count: number): string;
    clusterIcon(count: number, L?: typeof Leaflet): Leaflet.DivIcon;
    userDotHtml(): string;
    userDotIcon(L?: typeof Leaflet): Leaflet.DivIcon;
    placementHtml(): string;
    placementIcon(L?: typeof Leaflet): Leaflet.DivIcon;
    advisory: { line(type: AdvisoryType | string): Leaflet.PolylineOptions; area(): Leaflet.PolylineOptions; tooltip(title?: string): Leaflet.TooltipOptions; };
    route: { casing(): Leaflet.PolylineOptions; line(): Leaflet.PolylineOptions; };
  }
}

declare const RGIcons: RGIcons.API;
declare global {
  var RGIcons: RGIcons.API;
}
export = RGIcons;
