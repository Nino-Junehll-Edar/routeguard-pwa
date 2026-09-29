<script lang="ts">
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import Field from '$lib/components/primitives/Field.svelte';
  import Button from '$lib/components/primitives/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { loadProfile, profile } from '$lib/stores/profile';
  import { toast } from '$lib/stores/toast';

  let email = '';
  let password = '';
  let confirmPassword = '';
  let fullName = '';
  let showPw = false;
  let showConfirmPw = false;
  let loading = false;
  let error = '';

  function friendly(msg: string) {
    if (/email already registered/i.test(msg)) return 'An account with this email already exists. Please log in instead.';
    if (/weak password/i.test(msg)) return 'Password should be at least 6 characters long.';
    if (/invalid email/i.test(msg)) return 'Please enter a valid email address.';
    return msg;
  }

  async function register() {
    error = '';
    if (!email.trim() || !password || !confirmPassword) {
      error = 'Please fill in all fields.';
      return;
    }
    if (password !== confirmPassword) {
      error = 'Passwords do not match.';
      return;
    }
    loading = true;
    try {
      const { error: e } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        data: {
          full_name: fullName
        }
      });
      if (e) {
        error = friendly(e.message);
        return;
      }
      toast('Check your email for confirmation link', 'g');
      goto('/login');
    } finally {
      loading = false;
    }
  }
</script>

<div class="page auth">
  <a class="back" href="/" aria-label="Back to map"><Icon name="back" size={20} /></a>
  <div class="card box">
    <div class="logo">
      <span class="mark"><Icon name="shield-check" size={34} /></span>
      <b>RouteGuard</b>
      <span class="sub">Road hazards, reported and routed around.</span>
    </div>

    <form on:submit|preventDefault={register}>
      <Field label="Full Name" id="reg-fullname">
        <input id="reg-fullname" class="input" type="text"
          bind:value={fullName} autocomplete="name" />
      </Field>
      <Field label="Email" id="reg-email">
        <input id="reg-email" class="input" type="email" bind:value={email} autocomplete="email" required />
      </Field>
      <Field label="Password" id="reg-pw" {error}>
        <div class="pw">
          {#if showPw}
            <input id="reg-pw-visible" class="input" type="text"
              bind:value={password} autocomplete="current-password" required />
          {:else}
            <input id="reg-pw-hidden" class="input" type="password"
              bind:value={password} autocomplete="current-password" required />
          {/if}
          <button type="button" class="toggle" aria-label={showPw ? 'Hide password' : 'Show password'}
            on:click={() => (showPw = !showPw)}>
            <Icon name={showPw ? 'eye-off' : 'eye'} size={16} />
          </button>
        </div>
      </Field>
      <Field label="Confirm Password" id="reg-cpw" {error}>
        <div class="pw">
          {#if showConfirmPw}
            <input id="reg-cpw-visible" class="input" type="text"
              bind:value={confirmPassword} autocomplete="current-password" required />
          {:else}
            <input id="reg-cpw-hidden" class="input" type="password"
              bind:value={confirmPassword} autocomplete="current-password" required />
          {/if}
          <button type="button" class="toggle" aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
            on:click={() => (showConfirmPw = !showConfirmPw)}>
            <Icon name={showConfirmPw ? 'eye-off' : 'eye'} size={16} />
          </button>
        </div>
      </Field>
      <Button type="submit" block loading={loading} class="btn-primary">
        Create Account
      </Button>
    </form>

    <p class="alt">Already have an account? <a href="/login">Sign in</a></p>
    <p class="alt">LGU or agency personnel? <a href="/agency-request">Request access</a></p>
  </div>
</div>