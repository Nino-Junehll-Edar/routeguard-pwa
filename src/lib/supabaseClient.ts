import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
	|| import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabasePublicKey) {
	throw new Error('Missing VITE_SUPABASE_URL or a Supabase publishable/anon key')
}

export const supabase = createClient(supabaseUrl, supabasePublicKey)