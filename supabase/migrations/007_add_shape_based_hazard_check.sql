-- Add shape column to hazards table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'hazards'
        AND column_name = 'shape'
    ) THEN
        ALTER TABLE public.hazards ADD COLUMN shape GEOGRAPHY;
    END IF;
END $$;

-- Add spatial index on shape column for efficient spatial queries
CREATE INDEX IF NOT EXISTS idx_hazards_shape ON public.hazards USING GIST (shape);

-- Add function to check if a point is within any hazard shape
CREATE OR REPLACE FUNCTION public.get_hazards_containing_point(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_hazard_types TEXT[],
    p_status TEXT,
    p_include_expired BOOLEAN,
    p_limit INTEGER,
    p_offset INTEGER
)
RETURNS TABLE (hazard JSONB)
LANGUAGE sql
STABLE
SET search_path = extensions, public
AS $$
    SELECT
        to_jsonb(h)
    FROM public.hazards AS h
    WHERE h.shape IS NOT NULL
      AND ST_Intersects(
          h.shape,
          ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
      )
      AND (p_hazard_types IS NULL OR h.hazard_type = ANY(p_hazard_types))
      AND (p_status IS NULL OR h.status::TEXT = p_status)
      AND (COALESCE(p_include_expired, FALSE) OR h.status::TEXT <> 'expired')
    ORDER BY h.created_at DESC
    LIMIT p_limit
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- Add function to count hazards containing a point
CREATE OR REPLACE FUNCTION public.count_hazards_containing_point(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_hazard_types TEXT[],
    p_status TEXT,
    p_include_expired BOOLEAN
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = extensions, public
AS $$
    SELECT COUNT(*)
    FROM public.hazards AS h
    WHERE h.shape IS NOT NULL
      AND ST_Intersects(
          h.shape,
          ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
      )
      AND (p_hazard_types IS NULL OR h.hazard_type = ANY(p_hazard_types))
      AND (p_status IS NULL OR h.status::TEXT = p_status)
      AND (COALESCE(p_include_expired, FALSE) OR h.status::TEXT <> 'expired');
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_hazards_containing_point(
    DOUBLE PRECISION, DOUBLE PRECISION,
    TEXT[], TEXT, BOOLEAN, INTEGER, INTEGER
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.count_hazards_containing_point(
    DOUBLE PRECISION, DOUBLE PRECISION,
    TEXT[], TEXT, BOOLEAN
) TO anon, authenticated;