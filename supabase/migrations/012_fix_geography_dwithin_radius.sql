CREATE OR REPLACE FUNCTION public.check_hazard_verification(p_hazard_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = extensions, public
AS $$
DECLARE
    similar_count INTEGER;
    v_hazard_type TEXT;
BEGIN
    SELECT hazard_type
    INTO v_hazard_type
    FROM public.hazards
    WHERE id = p_hazard_id;

    SELECT COUNT(*)
    INTO similar_count
    FROM public.hazards
    WHERE id <> p_hazard_id
      AND hazard_type = v_hazard_type
      AND ST_DWithin(
          location,
          (SELECT location FROM public.hazards WHERE id = p_hazard_id),
          100::DOUBLE PRECISION
      )
      AND created_at > NOW() - INTERVAL '1 hour'
      AND status IN ('unconfirmed', 'needs_verification');

    IF similar_count >= 4 THEN
        UPDATE public.hazards
        SET status = 'needs_verification'
        WHERE id = p_hazard_id;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
