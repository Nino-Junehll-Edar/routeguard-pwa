<script lang="ts">
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import Field from '$lib/components/primitives/Field.svelte';
  import Button from '$lib/components/primitives/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { loadProfile, profile } from '$lib/stores/profile';
  import { show } from '$lib/stores/toast';

  let email = '';
  let password = '';
  let showPw = false;
  let loading = false;
  let error = '';

  function friendly(msg: string) {
    if (/invalid login credentials/i.test(msg)) return 'Email or password is incorrect.';
    if (/email not confirmed/i.test(msg)) return 'Please verify your email first - check your inbox.';
    if (/rate limit/i.test(msg)) return 'Too many attempts - wait a minute and try again.';
    return msg;
  }

  async function login() {
    error = '';
    if (!email.trim() || !password) { error = 'Enter your email and password.'; return; }
    loading = true;
    try {
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e) { error = friendly(e.message); return; }
      await loadProfile();
      const p = get(profile);
      goto(p?.role === 'admin' ? '/admin' : p?.role === 'agency_personnel' ? '/agency' : '/');
      show(p?.full_name ? `Welcome back, ${p.full_name.split(' ')[0]}` : 'Welcome back', 'g');
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

    <form on:submit|preventDefault={login}>
      <Field label="Email" id="li-email">
        <input id="li-email" class="input" type="email" bind:value={email} autocomplete="email" required />
      </Field>
      <Field label="Password" id="li-pw" {error}>
        <div class="pw">
          {#if showPw}
            <input id="li-pw-visible" class="input" type="text"
              bind:value={password} autocomplete="current-password" required />
          {:else}
            <input id="li-pw-hidden" class="input" type="password"
              bind:value={password} autocomplete="current-password" required />
          {/if}
          <button type="button" class="toggle" aria-label={showPw ? 'Hide password' : 'Show password'}
            on:click={() => (showPw = !showPw)}>
            <Icon name={showPw ? 'eye-off' : 'eye'} size={16} />
          </button>
        </div>
      </Field>
      <Button type="submit" block loading={loading}>Sign in</Button>
    </form>

    <p class="alt">No account yet? <a href="/register">Create one</a></p>
    <p class="alt">LGU or agency personnel? <a href="/agency-request">Request access</a></p>
  </div>
</div>