-- RouteGuard Spatial Index Optimization
-- Adding composite indexes for common spatial query patterns

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Composite index for hazards: filtering by status and doing spatial queries
-- This helps with queries like: SELECT * FROM hazards WHERE status != 'expired' AND location && ST_MakeEnvelope(...)
CREATE INDEX IF NOT EXISTS idx_hazards_status_location
ON public.hazards USING GIST (status, location);

-- Composite index for hazards: filtering by hazard_type and doing spatial queries
-- This helps with queries like: SELECT * FROM hazards WHERE hazard_type = 'flooding' && location && ST_MakeEnvelope(...)
CREATE INDEX IF NOT EXISTS idx_hazards_hazard_type_location
ON public.hazards USING GIST (hazard_type, location);

-- Composite index for agency advisories: filtering by is_active and doing spatial queries
-- This helps with queries like: SELECT * FROM agency_advisories WHERE is_active = true && geometry && ST_MakeEnvelope(...)
CREATE INDEX IF NOT EXISTS idx_agency_advisories_active_geometry
ON public.agency_advisories USING GIST (is_active, geometry);

-- Index for hazards on created_at for temporal queries combined with spatial
-- Helps with queries like: SELECT * FROM hazards WHERE created_at > NOW() - INTERVAL '24 hours' && location && ST_MakeEnvelope(...)
CREATE INDEX IF NOT EXISTS idx_hazards_created_at_location
ON public.hazards USING GIST (created_at, location);

-- Analyze tables to update statistics for query planner
ANALYZE public.hazards;
ANALYZE public.agency_advisories;