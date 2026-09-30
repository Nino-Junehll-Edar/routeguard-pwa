-- Optional vote-based reputation policy. Do not apply with migration 004.
CREATE OR REPLACE FUNCTION public.update_reputation_on_vote()
RETURNS TRIGGER AS $$
DECLARE
    v_hazard_reporter_id UUID;
    v_vote_impact INTEGER := 0;
    v_downvote_count INTEGER;
BEGIN
    SELECT reporter_id INTO v_hazard_reporter_id
    FROM public.hazards
    WHERE id = NEW.hazard_id;

    IF NEW.vote_type = 'downvote' THEN
        v_vote_impact := -2;
        SELECT COUNT(*) INTO v_downvote_count
        FROM public.hazard_votes
        WHERE hazard_id = NEW.hazard_id
          AND vote_type = 'downvote';

        IF v_downvote_count >= 3 THEN
            v_vote_impact := v_vote_impact - 10;
        END IF;
    END IF;

    UPDATE public.user_profiles
    SET reputation_points = reputation_points + v_vote_impact
    WHERE id = v_hazard_reporter_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reputation_on_vote_insert
    AFTER INSERT ON public.hazard_votes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_reputation_on_vote();