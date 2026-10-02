CREATE TABLE IF NOT EXISTS public.hazard_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hazard_id UUID NOT NULL REFERENCES public.hazards(id) ON DELETE CASCADE,
    flagger_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (char_length(BTRIM(reason)) BETWEEN 1 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_action TEXT CHECK (resolved_action IN ('expired', 'removed', 'dismissed')),
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hazard_flags_one_open_per_user
    ON public.hazard_flags (hazard_id, flagger_id)
    WHERE resolved_action IS NULL;
CREATE INDEX IF NOT EXISTS idx_hazard_flags_open_created
    ON public.hazard_flags (created_at DESC)
    WHERE resolved_action IS NULL;

ALTER TABLE public.hazard_flags ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.hazard_flags TO authenticated;

DROP POLICY IF EXISTS "Admins can view hazard flags" ON public.hazard_flags;
CREATE POLICY "Admins can view hazard flags"
    ON public.hazard_flags
    FOR SELECT
    USING (public.is_routeguard_admin());

CREATE OR REPLACE FUNCTION public.flag_hazard(
    p_hazard_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_reporter UUID;
    v_flag_id UUID;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Sign-in required';
    END IF;
    IF NULLIF(BTRIM(p_reason), '') IS NULL OR char_length(BTRIM(p_reason)) > 1000 THEN
        RAISE EXCEPTION 'A reason of 1 to 1000 characters is required';
    END IF;

    SELECT reporter_id INTO v_reporter
    FROM public.hazards
    WHERE id = p_hazard_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Hazard not found';
    END IF;
    IF v_reporter = v_actor THEN
        RAISE EXCEPTION 'You cannot flag your own report';
    END IF;

    INSERT INTO public.hazard_flags (hazard_id, flagger_id, reason)
    VALUES (p_hazard_id, v_actor, BTRIM(p_reason))
    ON CONFLICT (hazard_id, flagger_id) WHERE resolved_action IS NULL
    DO UPDATE SET reason = EXCLUDED.reason
    RETURNING id INTO v_flag_id;

    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, target_details)
    VALUES (
        v_actor,
        'hazard_flag_submitted',
        'hazard',
        p_hazard_id::TEXT,
        jsonb_build_object('flag_id', v_flag_id, 'reason', BTRIM(p_reason))
    );

    RETURN v_flag_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_hazard(
    p_flag_id UUID,
    p_action TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_hazard_id UUID;
    v_reporter UUID;
    v_reason TEXT := NULLIF(BTRIM(p_reason), '');
BEGIN
    IF v_actor IS NULL OR NOT public.is_routeguard_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;
    IF p_action IS NULL OR p_action NOT IN ('expire', 'remove', 'dismiss') THEN
        RAISE EXCEPTION 'Invalid moderation action';
    END IF;
    IF p_action = 'remove' AND v_reason IS NULL THEN
        RAISE EXCEPTION 'A removal reason is required';
    END IF;

    SELECT hazard_id INTO v_hazard_id
    FROM public.hazard_flags
    WHERE id = p_flag_id AND resolved_action IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Open hazard flag not found';
    END IF;

    IF p_action = 'dismiss' THEN
        UPDATE public.hazard_flags
        SET resolved_action = 'dismissed',
            resolved_by = v_actor,
            resolved_at = NOW(),
            resolution_reason = v_reason
        WHERE id = p_flag_id;
    ELSE
        SELECT reporter_id INTO v_reporter
        FROM public.hazards
        WHERE id = v_hazard_id
        FOR UPDATE;

        UPDATE public.hazards
        SET status = 'expired', lifetime_minutes = 0
        WHERE id = v_hazard_id;

        UPDATE public.hazard_flags
        SET resolved_action = CASE WHEN p_action = 'expire' THEN 'expired' ELSE 'removed' END,
            resolved_by = v_actor,
            resolved_at = NOW(),
            resolution_reason = v_reason
        WHERE hazard_id = v_hazard_id AND resolved_action IS NULL;

        IF p_action = 'remove' AND v_reporter IS NOT NULL THEN
            UPDATE public.user_profiles
            SET reputation_points = reputation_points - 10
            WHERE id = v_reporter;

            INSERT INTO public.notifications (user_id, type, title, body, hazard_id, data)
            VALUES (
                v_reporter,
                'hazard_moderated',
                'Hazard report removed',
                'A moderator removed your report. Reason: ' || v_reason,
                v_hazard_id,
                jsonb_build_object('reason', v_reason)
            );
        END IF;
    END IF;

    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, target_details)
    VALUES (
        v_actor,
        CASE p_action
            WHEN 'dismiss' THEN 'hazard_flag_dismissed'
            WHEN 'expire' THEN 'hazard_expired_by_moderator'
            ELSE 'hazard_removed_by_moderator'
        END,
        'hazard',
        v_hazard_id::TEXT,
        jsonb_build_object('flag_id', p_flag_id, 'action', p_action, 'reason', v_reason)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.flag_hazard(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderate_hazard(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flag_hazard(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_hazard(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
