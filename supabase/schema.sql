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
AS $$
BEGIN
    -- Check if profile already exists (to handle edge cases)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = NEW.id
    ) THEN
        INSERT INTO public.user_profiles (
            id,
            email,
            full_name,
            role,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            'common_user'::user_role,  -- Default role
            NOW(),
            NOW()
        );
    END IF;
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
    USING (is_active = TRUE);

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
DROP POLICY IF EXISTS "Anyone can view votes"
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

DROP POLICY IF EXISTS "Users can update their own votes"
    ON public.hazard_votes;

CREATE POLICY "Users can update their own votes"
    ON public.hazard_votes
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

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
          100
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