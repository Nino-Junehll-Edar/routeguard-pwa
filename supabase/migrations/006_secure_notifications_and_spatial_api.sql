-- Secure notification access and expose spatial queries through Postgres RPCs.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert confirmations"
    ON public.hazard_confirmations;
CREATE POLICY "Authenticated users can insert confirmations"
    ON public.hazard_confirmations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert hazards" ON public.hazards;
CREATE POLICY "Authenticated users can insert hazards"
    ON public.hazards FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Authenticated users can insert agency requests" ON public.agency_requests;
CREATE POLICY "Authenticated users can insert agency requests"
    ON public.agency_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.hazard_comments;
DROP POLICY IF EXISTS "Authenticated users can insert hazard comments" ON public.hazard_comments;
CREATE POLICY "Authenticated users can insert hazard comments"
    ON public.hazard_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert votes" ON public.hazard_votes;
DROP POLICY IF EXISTS "Authenticated users can insert hazard votes" ON public.hazard_votes;
CREATE POLICY "Authenticated users can insert hazard votes"
    ON public.hazard_votes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_hazard_verification_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.check_hazard_verification(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_hazard_verification_after_insert ON public.hazards;
CREATE TRIGGER check_hazard_verification_after_insert
    AFTER INSERT ON public.hazards
    FOR EACH ROW
    EXECUTE FUNCTION public.check_hazard_verification_trigger();

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (NEW.role IS DISTINCT FROM OLD.role
        OR NEW.reputation_points IS DISTINCT FROM OLD.reputation_points)
       AND COALESCE(auth.role(), '') <> 'service_role'
    AND COALESCE(current_setting('routeguard.allow_profile_adjustment', TRUE), 'false') <> 'true'
       AND NOT EXISTS (
           SELECT 1
           FROM public.user_profiles
           WHERE id = auth.uid()
             AND role = 'admin'
       ) THEN
        RAISE EXCEPTION 'Only admins can modify profile roles or reputation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.user_profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

CREATE OR REPLACE FUNCTION public.approve_agency_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_user_id UUID;
BEGIN
    IF v_admin_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = v_admin_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT user_id INTO v_user_id
    FROM public.agency_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending agency request not found';
    END IF;

    UPDATE public.agency_requests
    SET status = 'approved', reviewed_by = v_admin_id, reviewed_at = NOW()
    WHERE id = p_request_id;

    UPDATE public.user_profiles
    SET role = 'agency_personnel'
    WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_agency_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF v_admin_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = v_admin_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    UPDATE public.agency_requests
    SET status = 'rejected', reviewed_by = v_admin_id, reviewed_at = NOW()
    WHERE id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending agency request not found';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_agency_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_agency_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_agency_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_agency_request(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.verify_hazard(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.verify_hazard(UUID, TEXT);

CREATE FUNCTION public.verify_hazard(
    p_hazard_id UUID,
    p_verification_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reporter_id UUID;
    v_verification_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_verification_type IS NULL OR p_verification_type NOT IN ('hazard_active', 'hazard_cleared') THEN
        RAISE EXCEPTION 'Invalid verification type';
    END IF;

    SELECT reporter_id
    INTO v_reporter_id
    FROM public.hazards
    WHERE id = p_hazard_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Hazard not found';
    END IF;

    PERFORM set_config('routeguard.allow_profile_adjustment', 'true', TRUE);

    INSERT INTO public.hazard_confirmations (hazard_id, user_id, confirmation_type)
    VALUES (p_hazard_id, v_user_id, p_verification_type);

    IF p_verification_type = 'hazard_active' THEN
        UPDATE public.hazards
        SET status = 'hazard_active',
            lifetime_minutes = lifetime_minutes + 30
        WHERE id = p_hazard_id;

        UPDATE public.user_profiles
        SET reputation_points = reputation_points + 5
        WHERE id = v_reporter_id;
    ELSE
        UPDATE public.hazards
        SET status = 'hazard_cleared',
            lifetime_minutes = 0
        WHERE id = p_hazard_id;

        UPDATE public.user_profiles
        SET reputation_points = reputation_points - 2
        WHERE id = v_reporter_id;

        SELECT COUNT(*)
        INTO v_verification_count
        FROM public.hazard_confirmations
        WHERE hazard_id = p_hazard_id
          AND confirmation_type = 'hazard_cleared';

        IF v_verification_count >= 3 THEN
            UPDATE public.user_profiles
            SET reputation_points = reputation_points - 10
            WHERE id = v_reporter_id;
        END IF;
    END IF;

    PERFORM set_config('routeguard.allow_profile_adjustment', 'false', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_hazard(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_hazard(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_hazards_in_bounds(
    p_west DOUBLE PRECISION,
    p_south DOUBLE PRECISION,
    p_east DOUBLE PRECISION,
    p_north DOUBLE PRECISION,
    p_hazard_types TEXT[],
    p_status TEXT,
    p_since TIMESTAMPTZ,
    p_include_expired BOOLEAN,
    p_limit INTEGER,
    p_offset INTEGER
)
RETURNS SETOF public.hazards
LANGUAGE sql
STABLE
SET search_path = extensions, public
AS $$
    SELECT h.*
    FROM public.hazards AS h
    WHERE ST_Intersects(
        h.location,
        ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
    )
      AND (p_hazard_types IS NULL OR h.hazard_type = ANY(p_hazard_types))
      AND (p_status IS NULL OR h.status::TEXT = p_status)
      AND (p_since IS NULL OR h.updated_at >= p_since)
      AND (COALESCE(p_include_expired, FALSE) OR h.status::TEXT <> 'expired')
    ORDER BY h.created_at DESC
    LIMIT p_limit
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.count_hazards_in_bounds(
    p_west DOUBLE PRECISION,
    p_south DOUBLE PRECISION,
    p_east DOUBLE PRECISION,
    p_north DOUBLE PRECISION,
    p_hazard_types TEXT[],
    p_status TEXT,
    p_since TIMESTAMPTZ,
    p_include_expired BOOLEAN
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = extensions, public
AS $$
    SELECT COUNT(*)
    FROM public.hazards AS h
    WHERE ST_Intersects(
        h.location,
        ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
    )
      AND (p_hazard_types IS NULL OR h.hazard_type = ANY(p_hazard_types))
      AND (p_status IS NULL OR h.status::TEXT = p_status)
      AND (p_since IS NULL OR h.updated_at >= p_since)
      AND (COALESCE(p_include_expired, FALSE) OR h.status::TEXT <> 'expired');
$$;

CREATE OR REPLACE FUNCTION public.get_hazards_near_point(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_radius_meters DOUBLE PRECISION,
    p_hazard_types TEXT[],
    p_status TEXT,
    p_include_expired BOOLEAN,
    p_limit INTEGER,
    p_offset INTEGER
)
RETURNS TABLE (hazard JSONB, distance_meters DOUBLE PRECISION)
LANGUAGE sql
STABLE
SET search_path = extensions, public
AS $$
    SELECT
        to_jsonb(h),
        ST_Distance(
            h.location,
            ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
        )
    FROM public.hazards AS h
    WHERE ST_DWithin(
        h.location,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        GREATEST(p_radius_meters, 0)
    )
      AND (p_hazard_types IS NULL OR h.hazard_type = ANY(p_hazard_types))
      AND (p_status IS NULL OR h.status::TEXT = p_status)
      AND (COALESCE(p_include_expired, FALSE) OR h.status::TEXT <> 'expired')
    ORDER BY 2 ASC
    LIMIT p_limit
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.count_hazards_near_point(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_radius_meters DOUBLE PRECISION,
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
    WHERE ST_DWithin(
        h.location,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        GREATEST(p_radius_meters, 0)
    )
      AND (p_hazard_types IS NULL OR h.hazard_type = ANY(p_hazard_types))
      AND (p_status IS NULL OR h.status::TEXT = p_status)
      AND (COALESCE(p_include_expired, FALSE) OR h.status::TEXT <> 'expired');
$$;

GRANT EXECUTE ON FUNCTION public.get_hazards_in_bounds(
    DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
    TEXT[], TEXT, TIMESTAMPTZ, BOOLEAN, INTEGER, INTEGER
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_hazards_in_bounds(
    DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
    TEXT[], TEXT, TIMESTAMPTZ, BOOLEAN
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hazards_near_point(
    DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
    TEXT[], TEXT, BOOLEAN, INTEGER, INTEGER
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_hazards_near_point(
    DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
    TEXT[], TEXT, BOOLEAN
) TO anon, authenticated;