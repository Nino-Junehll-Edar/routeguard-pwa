-- RouteGuard Database Schema
-- PostgreSQL with PostGIS

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Custom enum types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
                JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
                WHERE pg_namespace.nspname = 'public'
                    AND pg_type.typname = 'hazard_status'
    ) THEN
        CREATE TYPE public.hazard_status AS ENUM (
            'unconfirmed',
            'needs_verification',
            'hazard_active',
            'hazard_cleared',
            'expired'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
                JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
                WHERE pg_namespace.nspname = 'public'
                    AND pg_type.typname = 'user_role'
    ) THEN
        CREATE TYPE public.user_role AS ENUM (
            'admin',
            'agency_personnel',
            'common_user'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
                JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
                WHERE pg_namespace.nspname = 'public'
                    AND pg_type.typname = 'agency_request_status'
    ) THEN
        CREATE TYPE public.agency_request_status AS ENUM (
            'pending',
            'approved',
            'rejected'
        );
    END IF;
END
$$;

-- Function for updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Users table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    full_name TEXT,

    email TEXT UNIQUE NOT NULL,

    role public.user_role NOT NULL
        DEFAULT 'common_user',

    reputation_points INTEGER NOT NULL
        DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);

-- Trigger to automatically create user profile when auth.user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Hazards table
CREATE TABLE IF NOT EXISTS public.hazards (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    reporter_id UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    location GEOGRAPHY(POINT, 4326) NOT NULL,
    building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
    shape GEOGRAPHY,  -- Optional shape defining the hazard area (polygon, circle, etc.)

    hazard_type TEXT NOT NULL,

    description TEXT,

    photo_url TEXT,

    status public.hazard_status NOT NULL
        DEFAULT 'unconfirmed',

    lifetime_minutes INTEGER NOT NULL
        DEFAULT 30,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    -- This is maintained by a trigger below.
    expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.hazards
    DROP CONSTRAINT IF EXISTS hazards_lifetime_minutes_positive;

-- Calculates expires_at without using a generated column.
CREATE OR REPLACE FUNCTION public.set_hazard_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.expires_at :=
        NEW.created_at
        + make_interval(mins => NEW.lifetime_minutes);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_hazard_expires_at
    ON public.hazards;

CREATE TRIGGER set_hazard_expires_at
BEFORE INSERT OR UPDATE OF created_at, lifetime_minutes
ON public.hazards
FOR EACH ROW
EXECUTE FUNCTION public.set_hazard_expires_at();

CREATE INDEX IF NOT EXISTS idx_hazards_location
    ON public.hazards
    USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_hazards_status
    ON public.hazards (status);

CREATE INDEX IF NOT EXISTS idx_hazards_created_at
    ON public.hazards (created_at);

CREATE INDEX IF NOT EXISTS idx_hazards_expires_at
    ON public.hazards (expires_at);

-- Agency requests table
CREATE TABLE IF NOT EXISTS public.agency_requests (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    full_name TEXT NOT NULL,

    agency TEXT NOT NULL,

    role TEXT NOT NULL,

    id_number TEXT,

    purpose TEXT,

    status public.agency_request_status NOT NULL
        DEFAULT 'pending',

    reviewed_by UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);

-- Agency advisories table
CREATE TABLE IF NOT EXISTS public.agency_advisories (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    created_by UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    title TEXT NOT NULL,

    description TEXT,

    advisory_type TEXT NOT NULL,

    geometry GEOGRAPHY,

    start_time TIMESTAMPTZ,

    end_time TIMESTAMPTZ,

    is_active BOOLEAN NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_advisories_geometry
    ON public.agency_advisories
    USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_agency_advisories_active
    ON public.agency_advisories (is_active);

-- Hazard confirmations table
CREATE TABLE IF NOT EXISTS public.hazard_confirmations (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    hazard_id UUID NOT NULL
        REFERENCES public.hazards(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    confirmation_type TEXT NOT NULL
        CHECK (
            confirmation_type IN (
                'hazard_active',
                'hazard_cleared'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);

-- Hazard comments table
CREATE TABLE IF NOT EXISTS public.hazard_comments (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    hazard_id UUID NOT NULL
        REFERENCES public.hazards(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    comment TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);

-- Hazard votes table
CREATE TABLE IF NOT EXISTS public.hazard_votes (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    hazard_id UUID NOT NULL
        REFERENCES public.hazards(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    vote_type TEXT NOT NULL
        CHECK (
            vote_type IN (
                'upvote',
                'downvote'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT hazard_votes_one_vote_per_user
        UNIQUE (hazard_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    hazard_id UUID REFERENCES public.hazards(id) ON DELETE SET NULL,
    data JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Buildings table for building-associated hazard reporting
CREATE TABLE IF NOT EXISTS public.buildings (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    building_name TEXT NOT NULL,

    building_code TEXT NOT NULL UNIQUE,

    latitude DOUBLE PRECISION NOT NULL,

    longitude DOUBLE PRECISION NOT NULL,

    width_meters INTEGER,

    height_meters INTEGER,

    rotation_degrees INTEGER DEFAULT 0,

    category TEXT CHECK (category IN ('academic', 'administrative', 'facility', 'sports', 'residential', 'other')),

    description TEXT,

    footprint GEOGRAPHY(POLYGON, 4326),  -- Building footprint as polygon

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);

-- Index for building location queries
CREATE INDEX IF NOT EXISTS idx_buildings_location
    ON public.buildings
    USING GIST (footprint);

-- Enable Row Level Security
ALTER TABLE public.user_profiles
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hazards
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agency_requests
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agency_advisories
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hazard_confirmations
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hazard_comments
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hazard_votes
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications
    ENABLE ROW LEVEL SECURITY;

-- Table privileges are required before row-level security policies are evaluated.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.hazards, public.agency_advisories,
    public.hazard_confirmations, public.hazard_comments, public.hazard_votes,
    public.buildings TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.user_profiles TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.hazards TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agency_requests TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.agency_advisories TO authenticated;
GRANT INSERT ON TABLE public.hazard_confirmations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.hazard_comments TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.hazard_votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO authenticated;

-- User profile policies
DROP POLICY IF EXISTS "Users can view their own profile"
    ON public.user_profiles;

CREATE POLICY "Users can view their own profile"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile"
    ON public.user_profiles;

CREATE POLICY "Users can update their own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

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

-- Hazard policies
DROP POLICY IF EXISTS "Anyone can view hazards"
    ON public.hazards;

CREATE POLICY "Anyone can view hazards"
    ON public.hazards
    FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can insert hazards"
    ON public.hazards;

CREATE POLICY "Authenticated users can insert hazards"
    ON public.hazards
    FOR INSERT
    WITH CHECK (
        auth.uid() = reporter_id
    );

DROP POLICY IF EXISTS "Users can update their own hazards"
    ON public.hazards;

CREATE POLICY "Users can update their own hazards"
    ON public.hazards
    FOR UPDATE
    USING (auth.uid() = reporter_id)
    WITH CHECK (auth.uid() = reporter_id);

-- Agency request policies
DROP POLICY IF EXISTS "Users can view their own agency requests"
    ON public.agency_requests;

CREATE POLICY "Users can view their own agency requests"
    ON public.agency_requests
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert agency requests"
    ON public.agency_requests;

CREATE POLICY "Authenticated users can insert agency requests"
    ON public.agency_requests
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
    );

DROP POLICY IF EXISTS "Admins can view all agency requests"
    ON public.agency_requests;

CREATE POLICY "Admins can view all agency requests"
    ON public.agency_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can update agency requests"
    ON public.agency_requests;

CREATE POLICY "Admins can update agency requests"
    ON public.agency_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'admin'
        )
    );

-- Agency advisory policies
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

GRANT SELECT ON TABLE public.agency_advisories TO anon, authenticated;

DROP POLICY IF EXISTS "Agency personnel can insert advisories"
    ON public.agency_advisories;

CREATE POLICY "Agency personnel can insert advisories"
    ON public.agency_advisories
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role = 'agency_personnel'
        )
    );

DROP POLICY IF EXISTS "Agency personnel can update their own advisories"
    ON public.agency_advisories;

CREATE POLICY "Agency personnel can update their own advisories"
    ON public.agency_advisories
    FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- Hazard confirmation policies
DROP POLICY IF EXISTS "Anyone can view confirmations"
    ON public.hazard_confirmations;

CREATE POLICY "Anyone can view confirmations"
    ON public.hazard_confirmations
    FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can insert confirmations"
    ON public.hazard_confirmations;

CREATE POLICY "Authenticated users can insert confirmations"
    ON public.hazard_confirmations
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
    );

-- Hazard comment policies
DROP POLICY IF EXISTS "Anyone can view comments"
    ON public.hazard_comments;

CREATE POLICY "Anyone can view comments"
    ON public.hazard_comments
    FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can insert comments"
    ON public.hazard_comments;

CREATE POLICY "Authenticated users can insert comments"
    ON public.hazard_comments
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
    );

DROP POLICY IF EXISTS "Users can update their own comments"
    ON public.hazard_comments;

CREATE POLICY "Users can update their own comments"
    ON public.hazard_comments
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments"
    ON public.hazard_comments;

CREATE POLICY "Users can delete their own comments"
    ON public.hazard_comments
    FOR DELETE
    USING (auth.uid() = user_id);

-- Hazard vote policies
DROP POLICY IF EXISTS "Anyone can vote"
    ON public.hazard_votes;

CREATE POLICY "Anyone can view votes"
    ON public.hazard_votes
    FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can insert votes"
    ON public.hazard_votes;

CREATE POLICY "Authenticated users can insert votes"
    ON public.hazard_votes
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND auth.uid() = user_id
    );

DROP POLICY IF EXISTS "Users can update their own votes"
    ON public.hazard_votes;

CREATE POLICY "Users can update their own votes"
    ON public.hazard_votes
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own notifications"
    ON public.notifications;

CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notifications"
    ON public.notifications;

CREATE POLICY "Users can insert own notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications"
    ON public.notifications;

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications"
    ON public.notifications;

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at
    ON public.user_profiles;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hazards_updated_at
    ON public.hazards;

CREATE TRIGGER update_hazards_updated_at
    BEFORE UPDATE ON public.hazards
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_agency_requests_updated_at
    ON public.agency_requests;

CREATE TRIGGER update_agency_requests_updated_at
    BEFORE UPDATE ON public.agency_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_agency_advisories_updated_at
    ON public.agency_advisories;

CREATE TRIGGER update_agency_advisories_updated_at
    BEFORE UPDATE ON public.agency_advisories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hazard_comments_updated_at
    ON public.hazard_comments;

CREATE TRIGGER update_hazard_comments_updated_at
    BEFORE UPDATE ON public.hazard_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Hazard verification function
CREATE OR REPLACE FUNCTION public.check_hazard_verification(
    p_hazard_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = extensions, public
AS $$
DECLARE
    similar_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO similar_count
    FROM public.hazards h
    WHERE h.id <> p_hazard_id
      AND h.hazard_type = (
          SELECT h2.hazard_type
          FROM public.hazards h2
          WHERE h2.id = p_hazard_id
      )
      AND ST_DWithin(
          h.location,
          (
              SELECT h3.location
              FROM public.hazards h3
              WHERE h3.id = p_hazard_id
          ),
          100::DOUBLE PRECISION
      )
      AND h.created_at > NOW() - INTERVAL '1 hour'
      AND h.status IN (
          'unconfirmed',
          'needs_verification'
      );

    IF similar_count >= 4 THEN
        UPDATE public.hazards
        SET status = 'needs_verification'
        WHERE id = p_hazard_id;
    END IF;
END;
$$;

-- Trigger wrapper function
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

DROP TRIGGER IF EXISTS check_hazard_verification_after_insert
    ON public.hazards;

CREATE TRIGGER check_hazard_verification_after_insert
    AFTER INSERT ON public.hazards
    FOR EACH ROW
    EXECUTE FUNCTION public.check_hazard_verification_trigger();


-- Add columns to user_profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'is_suspended'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'suspension_reason'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN suspension_reason TEXT;
    END IF;
END
$$;

-- Create audit_logs table if it doesn't exist
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

-- Function to check if user is admin
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

-- Policies for audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (public.is_routeguard_admin());

-- Update user_profiles policy for admins to view all
DROP POLICY IF EXISTS "Admins can view all user profiles" ON public.user_profiles;
CREATE POLICY "Admins can view all user profiles"
    ON public.user_profiles
    FOR SELECT
    USING (public.is_routeguard_admin());

-- Update agency_advisories policies
DROP POLICY IF EXISTS "Agency personnel can update their own advisories" ON public.agency_advisories;
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

-- Function: admin_set_role
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

-- Function: admin_set_suspension
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

-- Function: agency_review_hazard
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

-- Function: audit_agency_advisory_change (trigger function)
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

-- Trigger for agency_advisories
DROP TRIGGER IF EXISTS audit_agency_advisory_change
    ON public.agency_advisories;
CREATE TRIGGER audit_agency_advisory_change
    AFTER INSERT OR UPDATE ON public.agency_advisories
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_agency_advisory_change();

-- Function: agency_save_advisory
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

-- Function: admin_set_advisory_active
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

-- Function: get_agency_advisories
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

-- Revoke all on new functions from PUBLIC
REVOKE ALL ON FUNCTION public.admin_set_role(UUID, public.user_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_suspension(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agency_review_hazard(UUID, public.hazard_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agency_save_advisory(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_advisory_active(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_agency_advisories() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_routeguard_admin() FROM PUBLIC;

-- Grant execute on new functions to authenticated and anon
GRANT EXECUTE ON FUNCTION public.admin_set_role(UUID, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_suspension(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agency_review_hazard(UUID, public.hazard_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agency_save_advisory(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_advisory_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_advisories() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_routeguard_admin() TO anon, authenticated;

-- Hazard moderation queue
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

CREATE OR REPLACE FUNCTION public.flag_hazard(p_hazard_id UUID, p_reason TEXT)
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
    IF v_actor IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
    IF NULLIF(BTRIM(p_reason), '') IS NULL OR char_length(BTRIM(p_reason)) > 1000 THEN
        RAISE EXCEPTION 'A reason of 1 to 1000 characters is required';
    END IF;
    SELECT reporter_id INTO v_reporter FROM public.hazards WHERE id = p_hazard_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Hazard not found'; END IF;
    IF v_reporter = v_actor THEN RAISE EXCEPTION 'You cannot flag your own report'; END IF;

    INSERT INTO public.hazard_flags (hazard_id, flagger_id, reason)
    VALUES (p_hazard_id, v_actor, BTRIM(p_reason))
    ON CONFLICT (hazard_id, flagger_id) WHERE resolved_action IS NULL
    DO UPDATE SET reason = EXCLUDED.reason
    RETURNING id INTO v_flag_id;

    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, target_details)
    VALUES (v_actor, 'hazard_flag_submitted', 'hazard', p_hazard_id::TEXT,
            jsonb_build_object('flag_id', v_flag_id, 'reason', BTRIM(p_reason)));
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
    IF p_action = 'remove' AND v_reason IS NULL THEN RAISE EXCEPTION 'A removal reason is required'; END IF;

    SELECT hazard_id INTO v_hazard_id FROM public.hazard_flags
    WHERE id = p_flag_id AND resolved_action IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Open hazard flag not found'; END IF;

    IF p_action = 'dismiss' THEN
        UPDATE public.hazard_flags
        SET resolved_action = 'dismissed', resolved_by = v_actor, resolved_at = NOW(), resolution_reason = v_reason
        WHERE id = p_flag_id;
    ELSE
        SELECT reporter_id INTO v_reporter FROM public.hazards WHERE id = v_hazard_id FOR UPDATE;
        UPDATE public.hazards SET status = 'expired', lifetime_minutes = 0 WHERE id = v_hazard_id;
        UPDATE public.hazard_flags
        SET resolved_action = CASE WHEN p_action = 'expire' THEN 'expired' ELSE 'removed' END,
            resolved_by = v_actor, resolved_at = NOW(), resolution_reason = v_reason
        WHERE hazard_id = v_hazard_id AND resolved_action IS NULL;

        IF p_action = 'remove' AND v_reporter IS NOT NULL THEN
            UPDATE public.user_profiles SET reputation_points = reputation_points - 10 WHERE id = v_reporter;
            INSERT INTO public.notifications (user_id, type, title, body, hazard_id, data)
            VALUES (v_reporter, 'hazard_moderated', 'Hazard report removed',
                    'A moderator removed your report. Reason: ' || v_reason,
                    v_hazard_id, jsonb_build_object('reason', v_reason));
        END IF;
    END IF;

    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, target_details)
    VALUES (v_actor,
            CASE p_action WHEN 'dismiss' THEN 'hazard_flag_dismissed'
                          WHEN 'expire' THEN 'hazard_expired_by_moderator'
                          ELSE 'hazard_removed_by_moderator' END,
            'hazard', v_hazard_id::TEXT,
            jsonb_build_object('flag_id', p_flag_id, 'action', p_action, 'reason', v_reason));
END;
$$;

REVOKE ALL ON FUNCTION public.flag_hazard(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderate_hazard(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flag_hazard(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_hazard(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';