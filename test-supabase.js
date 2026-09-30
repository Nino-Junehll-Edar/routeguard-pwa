// Import and configure dotenv to load .env file
import 'dotenv/config';

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('count')
    .limit(1)

  if (error) {
    console.error('❌ Supabase Connection failed:', error)
    return false
  }

  console.log('✅ Supabase Connection successful!')
  console.log('   Project URL:', supabaseUrl)
  console.log('   Anon key loaded:', !!supabaseAnonKey)
  return true
}

testConnection()