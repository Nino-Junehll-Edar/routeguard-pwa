import { get, writable } from 'svelte/store'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { loadProfile, profile } from './stores/profile'

export { profile, loadProfile }

const userStore = writable<User | null>(null)
export const user = Object.assign(userStore, { get: () => get(userStore) })

// Auth state tracking
export const authLoading = writable<boolean>(true)
export const authError = writable<string | null>(null)
export const profileLoading = writable<boolean>(false)
export const profileError = writable<string | null>(null)

const AUTH_BOOTSTRAP_TIMEOUT_MS = 12_000
let authListener: { data: { subscription: { unsubscribe: () => void } } } | null = null

function withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), AUTH_BOOTSTRAP_TIMEOUT_MS)
    operation.then(
      value => {
        clearTimeout(timeout)
        resolve(value)
      },
      error => {
        clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

/** Initialize authentication with proper state management */
export async function initAuth() {
  // Clean up any existing listener
  if (authListener) {
    authListener?.data?.subscription?.unsubscribe()
    authListener = null
  }

  try {
    authLoading.set(true)
    authError.set(null)

    const { data: { session }, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      'Timed out connecting to Supabase. Check your connection, then retry.'
    )
    if (sessionError) throw sessionError
    user.set(session?.user ?? null)

    if (session?.user) {
      profileLoading.set(true)
      await withTimeout(
        loadProfile(),
        'Timed out loading your account profile. Check your connection, then retry.'
      )
      profileLoading.set(false)
    } else {
      profile.set(null)
    }

    // Set up auth state change listener
    authListener = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        user.set(session?.user ?? null)
        if (session?.user) {
          profileLoading.set(true)
          profileError.set(null)
          try {
            await loadProfile()
            profileLoading.set(false)
          } catch (error) {
            profileLoading.set(false)
            profileError.set(error instanceof Error ? error.message : 'Unknown error')
            console.error('Error loading profile:', error)
          }
        } else {
          profile.set(null)
        }
      } else if (event === 'SIGNED_OUT') {
        user.set(null)
        profile.set(null)
        profileLoading.set(false)
        profileError.set(null)
      }
    })
  } catch (error) {
    authLoading.set(false)
    authError.set(error instanceof Error ? error.message : 'Unknown error')
    console.error('Auth initialization error:', error)
    user.set(null)
    profile.set(null)
  } finally {
    // Ensure authLoading is set to false when initialization completes
    authLoading.set(false)
  }
}

/** Sign out the current user */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    // The onAuthStateChange listener will handle clearing state and redirect
  } catch (error) {
    console.error('Sign out error:', error)
    throw error
  }
}