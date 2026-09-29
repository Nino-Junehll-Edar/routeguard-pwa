import { get, writable } from 'svelte/store'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { loadProfile, profile } from './stores/profile'
import { goto } from '$app/navigation'

const userStore = writable<User | null>(null)
export const user = Object.assign(userStore, { get: () => get(userStore) })

// Auth state tracking
export const authLoading = writable<boolean>(true)
export const authError = writable<string | null>(null)
export const profileLoading = writable<boolean>(false)
export const profileError = writable<string | null>(null)

let authListener: { unsubscribe: () => void } | null = null

/** Initialize authentication with proper state management */
export async function initAuth() {
  // Clean up any existing listener
  if (authListener) {
    authListener.unsubscribe()
    authListener = null
  }

  try {
    authLoading.set(true)
    authError.set(null)

    const { data: { session } } = await supabase.auth.getSession()
    user.set(session?.user ?? null)

    if (session?.user) {
      profileLoading.set(true)
      await loadProfile()
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
        // Redirect to map page on sign out
        goto('/map')
      }
    })
  } catch (error) {
    authLoading.set(false)
    authError.set(error instanceof Error ? error.message : 'Unknown error')
    console.error('Auth initialization error:', error)
    user.set(null)
    profile.set(null)
  } finally {
    if (!authListener) {
      authLoading.set(false)
    }
  }
}

/** Sign out the current user */
export async function signOut() {
  try {
    await supabase.auth.signOut()
    // The onAuthStateChange listener will handle clearing state and redirect
  } catch (error) {
    console.error('Sign out error:', error)
    throw error
  }
}