-- Table privileges are required before row-level security policies are evaluated.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.hazards, public.agency_advisories,
	public.hazard_confirmations, public.hazard_comments, public.hazard_votes
	TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.user_profiles TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.hazards TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agency_requests TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.agency_advisories TO authenticated;
GRANT INSERT ON TABLE public.hazard_confirmations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.hazard_comments TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.hazard_votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO authenticated;

NOTIFY pgrst, 'reload schema';

