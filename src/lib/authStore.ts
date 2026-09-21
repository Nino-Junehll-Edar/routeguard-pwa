import { writable } from 'svelte/store'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export const user = writable<User | null>(null)

export async function initAuth() {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  if (session?.user) {
    user.set(session.user)
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    user.set(session?.user ?? null)
  })
}