ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target
    ON public.audit_logs (target_type, target_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.is_routeguard_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
$$;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (public.is_routeguard_admin());

DROP POLICY IF EXISTS "Admins can view all user profiles" ON public.user_profiles;
CREATE POLICY "Admins can view all user profiles"
    ON public.user_profiles
    FOR SELECT
    USING (public.is_routeguard_admin());

DROP POLICY IF EXISTS "Anyone can view active agency advisories"
    ON public.agency_advisories;
CREATE POLICY "Anyone can view active agency advisories"
    ON public.agency_advisories
    FOR SELECT
    USING (
        is_active = TRUE
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE id = auth.uid()
              AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Agency personnel can update their own advisories"
    ON public.agency_advisories;
CREATE POLICY "Agency personnel can update their own advisories"
    ON public.agency_advisories
    FOR UPDATE
    USING (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE id = auth.uid()
              AND role = 'agency_personnel'
        )
    )
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE id = auth.uid()
              AND role = 'agency_personnel'
        )
    );

CREATE OR REPLACE FUNCTION public.admin_set_role(
    p_user UUID,
    p_role public.user_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_old_role public.user_role;
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = v_actor AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;
    IF p_user = v_actor THEN
        RAISE EXCEPTION 'You cannot change your own role';
    END IF;

    SELECT role INTO v_old_role
    FROM public.user_profiles
    WHERE id = p_user
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;
    IF v_old_role = p_role THEN
        RETURN;
    END IF;

    UPDATE public.user_profiles SET role = p_role WHERE id = p_user;
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, target_details)
    VALUES (
        v_actor,
        'user_role_changed',
        'user_profile',
        p_user::TEXT,
        jsonb_build_object('old_role', v_old_role, 'new_role', p_role)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_suspension(
    p_user UUID,
    p_suspend BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_old_state BOOLEAN;
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = v_actor AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;
    IF p_user = v_actor THEN
        RAISE EXCEPTION 'You cannot suspend yourself';
    END IF;
    IF p_suspend AND NULLIF(BTRIM(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'A suspension reason is required';
    END IF;

    SELECT is_suspended INTO v_old_state
    FROM public.user_profiles
    WHERE id = p_user
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;
    IF v_old_state = p_suspend THEN
        RETURN;
    END IF;

    UPDATE public.user_profiles
    SET is_suspended = p_suspend,
        suspension_reason = CASE WHEN p_suspend THEN BTRIM(p_reason) ELSE NULL END
    WHERE id = p_user;
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, target_details)
    VALUES (
        v_actor,
        CASE WHEN p_suspend THEN 'user_suspended' ELSE 'user_reactivated' END,
        'user_profile',
        p_user::TEXT,
        jsonb_build_object('reason', CASE WHEN p_suspend THEN BTRIM(p_reason) ELSE NULL END)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.agency_review_hazard(
    p_hazard_id UUID,
    p_status public.hazard_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_old_status public.hazard_status;
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = v_actor AND role IN ('agency_personnel', 'admin')
    ) THEN
        RAISE EXCEPTION 'Agency or admin access required';
    END IF;
    IF p_status NOT IN ('hazard_active', 'hazard_cleared') THEN
        RAISE EXCEPTION 'Invalid staff review status';
    END IF;

    SELECT status INTO v_old_status
    FROM public.hazards
    WHERE id = p_hazard_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Hazard not found';
    END IF;
    IF v_old_status = p_status THEN
        RETURN;
    END IF;

    UPDATE public.hazards
    SET status = p_status,
        lifetime_minutes = CASE WHEN p_status = 'hazard_cleared' THEN 0 ELSE lifetime_minutes END
    WHERE id = p_hazard_id;
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, target_details)
    VALUES (
        v_actor,
        'hazard_reviewed',
        'hazard',
        p_hazard_id::TEXT,
        jsonb_build_object('old_status', v_old_status, 'new_status', p_status)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_agency_advisory_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, target_details)
    VALUES (
        auth.uid(),
        CASE WHEN TG_OP = 'INSERT' THEN 'agency_advisory_created' ELSE 'agency_advisory_updated' END,
        'agency_advisory',
        NEW.id::TEXT,
        jsonb_build_object(
            'title', NEW.title,
            'advisory_type', NEW.advisory_type,
            'is_active', NEW.is_active,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_agency_advisory_change
    ON public.agency_advisories;
CREATE TRIGGER audit_agency_advisory_change
    AFTER INSERT OR UPDATE ON public.agency_advisories
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_agency_advisory_change();

CREATE OR REPLACE FUNCTION public.agency_save_advisory(
    p_id UUID,
    p_title TEXT,
    p_advisory_type TEXT,
    p_description TEXT,
    p_geometry JSONB,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_is_active BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_role public.user_role;
    v_owner UUID;
    v_geometry GEOMETRY;
    v_id UUID;
BEGIN
    SELECT role INTO v_role
    FROM public.user_profiles
    WHERE id = v_actor;
    IF v_actor IS NULL OR v_role NOT IN ('agency_personnel', 'admin') THEN
        RAISE EXCEPTION 'Agency or admin access required';
    END IF;
    IF NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_advisory_type), '') IS NULL THEN
        RAISE EXCEPTION 'Title and advisory type are required';
    END IF;
    IF p_geometry IS NULL OR jsonb_typeof(p_geometry) <> 'object' THEN
        RAISE EXCEPTION 'A GeoJSON point, line, or polygon is required';
    END IF;
    IF p_start_time IS NOT NULL AND p_end_time IS NOT NULL AND p_end_time <= p_start_time THEN
        RAISE EXCEPTION 'End time must be after start time';
    END IF;

    v_geometry := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry::TEXT), 4326);
    IF ST_IsEmpty(v_geometry)
       OR NOT ST_IsValid(v_geometry)
       OR ST_GeometryType(v_geometry) NOT IN ('ST_Point', 'ST_LineString', 'ST_Polygon') THEN
        RAISE EXCEPTION 'Geometry must be a valid point, line, or polygon';
    END IF;

    IF p_id IS NULL THEN
        INSERT INTO public.agency_advisories (
            created_by, title, advisory_type, description, geometry,
            start_time, end_time, is_active
        ) VALUES (
            v_actor, BTRIM(p_title), BTRIM(p_advisory_type), NULLIF(BTRIM(p_description), ''),
            v_geometry::geography, p_start_time, p_end_time, COALESCE(p_is_active, TRUE)
        ) RETURNING id INTO v_id;
        RETURN v_id;
    END IF;

    SELECT created_by INTO v_owner
    FROM public.agency_advisories
    WHERE id = p_id
    FOR UPDATE;
    IF NOT FOUND OR (v_owner IS DISTINCT FROM v_actor AND v_role <> 'admin') THEN
        RAISE EXCEPTION 'Advisory not found or access denied';
    END IF;

    UPDATE public.agency_advisories
    SET title = BTRIM(p_title),
        advisory_type = BTRIM(p_advisory_type),
        description = NULLIF(BTRIM(p_description), ''),
        geometry = v_geometry::geography,
        start_time = p_start_time,
        end_time = p_end_time,
        is_active = COALESCE(p_is_active, TRUE)
    WHERE id = p_id
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_advisory_active(
    p_advisory_id UUID,
    p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_routeguard_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;
    UPDATE public.agency_advisories
    SET is_active = p_is_active
    WHERE id = p_advisory_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Advisory not found';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agency_advisories()
RETURNS TABLE (
    id UUID,
    created_by UUID,
    title TEXT,
    description TEXT,
    advisory_type TEXT,
    geometry JSONB,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = extensions, public
AS $$
    SELECT
        advisory.id,
        advisory.created_by,
        advisory.title,
        advisory.description,
        advisory.advisory_type,
        ST_AsGeoJSON(advisory.geometry::geometry)::JSONB,
        advisory.start_time,
        advisory.end_time,
        advisory.is_active,
        advisory.created_at,
        advisory.updated_at
    FROM public.agency_advisories AS advisory
    ORDER BY advisory.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_set_role(UUID, public.user_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_suspension(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agency_review_hazard(UUID, public.hazard_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agency_save_advisory(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_advisory_active(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_agency_advisories() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_routeguard_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_role(UUID, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_suspension(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agency_review_hazard(UUID, public.hazard_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agency_save_advisory(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_advisory_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_advisories() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_routeguard_admin() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';