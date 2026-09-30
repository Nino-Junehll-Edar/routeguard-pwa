-- Update verify_hazard function to include reputation effects for both hazard_active and hazard_cleared verifications
CREATE OR REPLACE FUNCTION public.verify_hazard(
    p_hazard_id UUID,
    p_verification_type TEXT, -- 'hazard_active' or 'hazard_cleared'
    p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_lifetime_adjustment INTEGER := 30; -- Default adjustment: 30 minutes
    v_current_lifetime INTEGER;
    v_reporter_id UUID;
    v_verification_count INTEGER;
BEGIN
    -- Insert confirmation record
    INSERT INTO public.hazard_confirmations (hazard_id, user_id, confirmation_type)
    VALUES (p_hazard_id, p_user_id, p_verification_type);

    -- Get current lifetime and reporter id
    SELECT lifetime_minutes, reporter_id INTO v_current_lifetime, v_reporter_id
    FROM public.hazards
    WHERE id = p_hazard_id;

    -- Adjust lifetime based on verification type
    IF p_verification_type = 'hazard_active' THEN
        -- Extend lifetime for active hazards
        UPDATE public.hazards
        SET status = 'hazard_active',
            lifetime_minutes = GREATEST(lifetime_minutes + v_lifetime_adjustment, 0)
        WHERE id = p_hazard_id;

        -- Award reputation points to the reporter for confirming an active hazard
        UPDATE public.user_profiles
        SET reputation_points = reputation_points + 5
        WHERE id = v_reporter_id;
    ELSIF p_verification_type = 'hazard_cleared' THEN
        -- Set lifetime to 0 for cleared hazards (expires immediately)
        UPDATE public.hazards
        SET status = 'hazard_cleared',
            lifetime_minutes = 0
        WHERE id = p_hazard_id;

        -- Apply reputation penalty for confirming a hazard as cleared
        UPDATE public.user_profiles
        SET reputation_points = reputation_points - 2
        WHERE id = v_reporter_id;

        -- Check if this is the 3rd+ hazard_cleared verification for this hazard
        SELECT COUNT(*) INTO v_verification_count
        FROM public.hazard_confirmations
        WHERE hazard_id = p_hazard_id
        AND confirmation_type = 'hazard_cleared';

        -- Apply additional penalty when 3+ users mark hazard as cleared
        IF v_verification_count >= 3 THEN
            UPDATE public.user_profiles
            SET reputation_points = reputation_points - 10
            WHERE id = v_reporter_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;