-- RouteGuard Database Schema
-- Using PostgreSQL with PostGIS extension

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Custom types
CREATE TYPE hazard_status AS ENUM ('unconfirmed', 'needs_verification', 'hazard_active', 'hazard_cleared', 'expired');
CREATE TYPE user_role AS ENUM ('admin', 'agency_personnel', 'common_user');
CREATE TYPE agency_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    email TEXT UNIQUE NOT NULL,
    role user_role DEFAULT 'common_user',
    reputation_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hazards table
CREATE TABLE public.hazards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users ON DELETE SET NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    hazard_type TEXT NOT NULL, -- e.g., 'flooding', 'debris', 'roadblock'
    description TEXT,
    photo_url TEXT, -- URL to photo in Supabase Storage
    status hazard_status DEFAULT 'unconfirmed',
    lifetime_minutes INTEGER DEFAULT 30, -- How long until report expires
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (created_at + (lifetime_minutes * interval '1 minute')) STORED
);

CREATE INDEX idx_hazards_location ON public.hazards USING GIST (location);
CREATE INDEX idx_hazards_status ON public.hazards (status);
CREATE INDEX idx_hazards_created_at ON public.hazards (created_at);

-- Agency requests table
CREATE TABLE public.agency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    agency TEXT NOT NULL,
    role TEXT NOT NULL,
    id_number TEXT,
    purpose TEXT,
    status agency_request_status DEFAULT 'pending',
    reviewed_by UUID REFERENCES auth.users ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agency advisories table (for official advisories from LGU)
CREATE TABLE public.agency_advisories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    advisory_type TEXT NOT NULL, -- e.g., 'roadwork', 'festival', 'construction'
    geometry GEOGRAPHY, -- Can be POINT, LINESTRING, POLYGON
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agency_advisories_geometry ON public.agency_advisories USING GIST (geometry);
CREATE INDEX idx_agency_advisories_active ON public.agency_advisories (is_active);

-- Reports/confirmations table (for hazard active/cleared clicks)
CREATE TABLE public.hazard_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hazard_id UUID REFERENCES public.hazards ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    confirmation_type TEXT NOT NULL CHECK (confirmation_type IN ('hazard_active', 'hazard_cleared')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table for hazards
CREATE TABLE public.hazard_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hazard_id UUID REFERENCES public.hazards ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes/upvotes/downvotes table
CREATE TABLE public.hazard_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hazard_id UUID REFERENCES public.hazards ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hazard_id, user_id) -- One vote per user per hazard
);

-- Notifications table for in-app notification center
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- e.g., 'proximity_alert', 'verification_prompt', 'hazard_verified'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    hazard_id UUID REFERENCES public.hazards ON DELETE SET NULL,
    data JSONB, -- Additional data for the notification
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

-- Row Level Security (RLS) Policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_advisories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_votes ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Policies for hazards
CREATE POLICY "Anyone can view hazards" ON public.hazards
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert hazards" ON public.hazards
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own hazards" ON public.hazards
    FOR UPDATE USING (auth.uid() = reporter_id);

-- Policies for agency_requests
CREATE POLICY "Users can view their own agency requests" ON public.agency_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert agency requests" ON public.agency_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can view all agency requests" ON public.agency_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update agency requests" ON public.agency_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policies for agency_advisories
CREATE POLICY "Anyone can view active agency advisories" ON public.agency_advisories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Agency personnel can insert advisories" ON public.agency_advisories
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'agency_personnel'
        )
    );

CREATE POLICY "Agency personnel can update their own advisories" ON public.agency_advisories
    FOR UPDATE USING (
        auth.uid() = created_by
    );

-- Policies for hazard_confirmations
CREATE POLICY "Anyone can view confirmations" ON public.hazard_confirmations
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert confirmations" ON public.hazard_confirmations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for hazard_comments
CREATE POLICY "Anyone can view comments" ON public.hazard_comments
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert comments" ON public.hazard_comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own comments" ON public.hazard_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.hazard_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for hazard_votes
CREATE POLICY "Anyone can view votes" ON public.hazard_votes
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert votes" ON public.hazard_votes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own votes" ON public.hazard_votes
    FOR UPDATE USING (auth.uid() = user_id);

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at columns
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hazards_updated_at
    BEFORE UPDATE ON public.hazards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_requests_updated_at
    BEFORE UPDATE ON public.agency_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_advisories_updated_at
    BEFORE UPDATE ON public.agency_advisories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hazard_comments_updated_at
    BEFORE UPDATE ON public.hazard_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Supplementary functions for hazard management
CREATE OR REPLACE FUNCTION check_hazard_verification(hazard_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = extensions, public
AS $$
DECLARE
    similar_count INTEGER;
    v_hazard_type TEXT;
BEGIN
    -- Get hazard type for the hazard
    SELECT hazard_type INTO v_hazard_type
    FROM public.hazards
    WHERE id = hazard_id;

    -- Count similar hazards (same type, within 100m, within last hour)
    SELECT COUNT(*) INTO similar_count
    FROM public.hazards
    WHERE id != hazard_id
    AND hazard_type = v_hazard_type
    AND ST_DWithin(location, (SELECT location FROM public.hazards WHERE id = hazard_id), 100)
    AND created_at > NOW() - INTERVAL '1 hour'
    AND status IN ('unconfirmed', 'needs_verification');

    -- If 5+ similar reports, flag for verification
    IF similar_count >= 4 THEN -- Current + 4 others = 5 total
        UPDATE public.hazards
        SET status = 'needs_verification'
        WHERE id = hazard_id;

    END IF;
END;
$$;

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

-- Trigger to check verification after hazard insert
DROP TRIGGER IF EXISTS check_hazard_verification_after_insert ON public.hazards;
CREATE TRIGGER check_hazard_verification_after_insert
    AFTER INSERT ON public.hazards
    FOR EACH ROW
    EXECUTE FUNCTION public.check_hazard_verification_trigger();

-- Function to verify a hazard (mark as active or cleared)
-- NOTE: The reputation update for active hazard confirmation is in migration 002
CREATE OR REPLACE FUNCTION verify_hazard(
    p_hazard_id UUID,
    p_verification_type TEXT, -- 'hazard_active' or 'hazard_cleared'
    p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_lifetime_adjustment INTEGER := 30; -- Default adjustment: 30 minutes
    v_current_lifetime INTEGER;
BEGIN
    -- Insert confirmation record
    INSERT INTO public.hazard_confirmations (hazard_id, user_id, confirmation_type)
    VALUES (p_hazard_id, p_user_id, p_verification_type);

    -- Get current lifetime
    SELECT lifetime_minutes INTO v_current_lifetime
    FROM public.hazards
    WHERE id = p_hazard_id;

    -- Adjust lifetime based on verification type
    IF p_verification_type = 'hazard_active' THEN
        -- Extend lifetime for active hazards
        UPDATE public.hazards
        SET status = 'hazard_active',
            lifetime_minutes = GREATEST(lifetime_minutes + v_lifetime_adjustment, 0)
        WHERE id = p_hazard_id;
    ELSIF p_verification_type = 'hazard_cleared' THEN
        -- Set lifetime to 0 for cleared hazards (expires immediately)
        UPDATE public.hazards
        SET status = 'hazard_cleared',
            lifetime_minutes = 0
        WHERE id = p_hazard_id;
    END IF;
END;
$$
LANGUAGE plpgsql;

-- Function to automatically expire hazards when lifetime reaches 0
CREATE OR REPLACE FUNCTION public.expire_hazards()
RETURNS VOID AS $$
DECLARE
    v_hazard_id UUID;
    v_cursor CURSOR FOR
        SELECT id FROM public.hazards
        WHERE lifetime_minutes <= 0
        AND status NOT IN ('expired', 'hazard_cleared');
BEGIN
    OPEN v_cursor;
    LOOP
        FETCH v_cursor INTO v_hazard_id;
        EXIT WHEN NOT FOUND;

        UPDATE public.hazards
        SET status = 'expired',
            lifetime_minutes = 0
        WHERE id = v_hazard_id;

        -- Optionally, you could send a notification here when a hazard expires
    END LOOP;
    CLOSE v_cursor;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically check for expired hazards (could also be done via a cron job)
-- For now, we'll call this function periodically from the frontend or use a database trigger on update
CREATE OR REPLACE FUNCTION public.check_and_expire_hazards_on_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If lifetime_minutes is updated to 0 or less, set status to expired
    IF NEW.lifetime_minutes <= 0 AND NEW.status NOT IN ('expired', 'hazard_cleared') THEN
        NEW.status := 'expired';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_and_expire_hazards_on_update
    BEFORE UPDATE ON public.hazards
    FOR EACH ROW
    EXECUTE FUNCTION public.check_and_expire_hazards_on_update();