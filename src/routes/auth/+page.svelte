<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/authStore';
  import { loadProfile, profile } from '$lib/stores/profile';
  import { submitAgencyRequest as submitAgencyAccessRequest } from '$lib/agencyUtils';
  import { show } from '$lib/stores/toast';
  import Icon from '$lib/components/Icon.svelte';

  let email = '';
  let password = '';
  let fullName = '';
  let confirmPassword = '';
  let showPw = false;
  let showConfirmPw = false;
  let loading = false;
  let error = '';
  let activeTab = 'signin'; // signin or signup
  let activeSide = 'community'; // community or agency
  let agencyRequestData = {
    full_name: '',
    agency: '',
    role: '',
    id_number: '',
    purpose: ''
  };

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const sideQuery = params.get('side');
    const tabQuery = params.get('tab');

    if (sideQuery === 'agency') {
      activeSide = 'agency';
    }

    if (tabQuery === 'signup') {
      activeTab = 'signup';
    } else if (tabQuery === 'request') {
      activeTab = 'request';
    } else {
      activeTab = 'signin';
    }
  });

  function togglePasswordVisibility() {
    showPw = !showPw;
  }

  function toggleConfirmPasswordVisibility() {
    showConfirmPw = !showConfirmPw;
  }
  let agencyRequestLoading = false;
  let agencyRequestError = '';
  let agencyRequestSuccess = '';

  // Login function
  async function login() {
    error = '';
    if (!email.trim() || !password) {
      error = 'Enter your email and password.';
      return;
    }
    loading = true;
    try {
      const { error: e } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (e) {
        error = 'Email or password is incorrect.';
        return;
      }
      await loadProfile();
      const p = get(profile);
      if (p?.role === 'admin') window.location.assign('/admin/agency-requests');
      else if (p?.role === 'agency_personnel') window.location.assign('/agency');
      else window.location.assign('/map');
      show(p?.full_name ? `Welcome back, ${p.full_name.split(' ')[0]}` : 'Welcome back', 'g');
    } finally {
      loading = false;
    }
  }

  // Register function
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
        options: {
          data: {
            full_name: fullName
          }
        }
      });
      if (e) {
        if (/email already registered/i.test(e.message)) {
          error = 'An account with this email already exists. Please log in instead.';
        } else if (/weak password/i.test(e.message)) {
          error = 'Password should be at least 6 characters long.';
        } else if (/invalid email/i.test(e.message)) {
          error = 'Please enter a valid email address.';
        } else {
          error = e.message;
        }
        return;
      }
      show('Check your email for confirmation link', 'g');
      activeTab = 'signin';
      email = '';
      password = '';
      confirmPassword = '';
      fullName = '';
    } finally {
      loading = false;
    }
  }

  // Agency request function
  async function handleAgencyRequestSubmit() {
    agencyRequestError = '';
    agencyRequestSuccess = '';

    if (!agencyRequestData.full_name || !agencyRequestData.agency || !agencyRequestData.role || !agencyRequestData.purpose) {
      agencyRequestError = 'Please fill in all required fields';
      return;
    }

    if (!get(user)) {
      agencyRequestError = 'Please sign in before requesting agency access.';
      activeTab = 'signin';
      return;
    }

    agencyRequestLoading = true;
    try {
      const result = await submitAgencyAccessRequest({
        full_name: agencyRequestData.full_name,
        agency: agencyRequestData.agency,
        role: agencyRequestData.role,
        id_number: agencyRequestData.id_number,
        purpose: agencyRequestData.purpose
      });

      if (!result.success) {
        agencyRequestError = result.error || 'Could not submit your agency request.';
        return;
      }

      agencyRequestSuccess = 'Your agency request has been submitted successfully! An administrator will review it shortly.';
      agencyRequestData = {
        full_name: '',
        agency: '',
        role: '',
        id_number: '',
        purpose: ''
      };
    } catch (error) {
      console.error('Error submitting agency request:', error);
      agencyRequestError = 'An unexpected error occurred. Please try again later.';
    } finally {
      agencyRequestLoading = false;
    }
  }

  // Helper functions
  function friendly(msg: string) {
    if (/invalid login credentials/i.test(msg)) return 'Email or password is incorrect.';
    if (/email not confirmed/i.test(msg)) return 'Please verify your email first - check your inbox.';
    if (/rate limit/i.test(msg)) return 'Too many attempts - wait a minute and try again.';
    return msg;
  }

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
</script>

<style>
  /* Import CSS variables from the design overhaul */
  :root{
    --bg:#F7F8FA;--surface:#FFFFFF;--raised:#FFFFFF;--border:#DDE3EA;--ink:#12161A;--ink2:#4A545E;
    --primary:#1B5CA8;--primary-ink:#0F3460;--primary-surface:#E7F0FA;--danger:#C4271E;--danger-sf:#FBE9E7;
    --warning:#B45309;--warning-sf:#FCF0DD;--caution:#F0A400;--neutral:#64748B;--neutral-sf:#EEF1F5;
    --success:#2E8555;--success-sf:#E4F3EB;--advisory:#6D28D9;--advisory-sf:#F1EAFB;--route:#1D66C9;--gold:#B7791F;
    --map-land:#EDF1F6;--map-water:#C9E0F4;--map-road:#FFFFFF;--map-minor:#F2F5F9;--map-pk:#DDEAD9;--map-lbl:#5B6B7B;
    --r-s:8px;--r-m:12px;--r-l:16px;--e1:0 1px 2px rgba(10,20,30,.12);--e2:0 4px 14px rgba(10,20,30,.16);--e3:0 12px 32px rgba(10,20,30,.22);
    --ease:cubic-bezier(.32,.72,.24,1);--f:'Public Sans',system-ui,-apple-system,sans-serif;--navh:70px
  }
  [data-theme=dark]{
    --bg:#0E1116;--surface:#161B22;--raised:#1C2430;--border:#2A3340;--ink:#E6EAF0;--ink2:#9AA7B4;
    --primary:#5E93D6;--primary-ink:#C5D9F2;--primary-surface:#12283F;--danger:#FF6B4A;--danger-sf:#2E1512;
    --warning:#FFC24B;--warning-sf:#2A1F0E;--caution:#E0B341;--neutral:#94A3B8;--neutral-sf:#1D242E;
    --success:#4AC97E;--success-sf:#12271B;--advisory:#A78BFA;--advisory-sf:#1D1533;--route:#6EA8FF;--gold:#E9B44C;
    --map-land:#12171E;--map-water:#0E2438;--map-road:#39434F;--map-minor:#1D242E;--map-pk:#17251B;--map-lbl:#7C8A99
  }

  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--f);background:var(--bg);color:var(--ink);font-size:14.5px;line-height:1.5;-webkit-font-smoothing:antialiased}
  button{font:inherit;color:inherit;background:none;border:none;cursor:pointer}
  input,select,textarea{font:inherit;color:var(--ink)}
  a{color:var(--primary);font-weight:700;text-decoration:none}
  .tnum{font-variant-numeric:tabular-nums}.hint{font-size:12px;color:var(--ink2)}.sub{color:var(--ink2);font-size:13px}
  #errbox{display:none;position:fixed;bottom:8px;left:8px;right:8px;z-index:9999;background:#7A2A20;color:#fff;font:12px/1.5 ui-monospace,monospace;padding:10px 12px;border-radius:8px;max-height:40vh;overflow:auto}
  /* proto bar */
  #proto{position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:9px 16px;background:#101418;color:#E6EAF0;border-bottom:1px solid #232a33;font-size:13px}
  #proto .lg{font-weight:800;display:flex;gap:8px;align-items:center;margin-right:auto}
  #proto .lg svg{width:18px;height:18px;stroke:#5E93D6}#proto .lg span{color:#6b7684;font-weight:600}
  .pbtn{padding:5px 12px;border:1px solid #333d49;border-radius:8px;color:#9AA7B4;font-weight:600;font-size:12.5px}
  .pbtn.on{background:#152a18;border-color:#2E8555;color:#7EE2A8}
  /* views */
  .view{display:none}.view.on{display:block}
  /* ============ AUTH (slider card) ============ */
  #view-auth.on{display:flex;min-height:calc(100vh - 52px);align-items:center;justify-content:center;padding:24px 16px;background:linear-gradient(160deg,var(--primary-surface),var(--bg) 55%,var(--advisory-sf))}
  .brand{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px;text-align:center}
  .mark{width:64px;height:64px;border-radius:18px;background:var(--primary);color:#fff;display:grid;place-items:center;box-shadow:var(--e2)}
  .mark svg{width:34px;height:34px}
  .brand b{font-size:21px;font-weight:800;letter-spacing:-.3px}
  .brand span{font-size:13px;color:var(--ink2)}
  .acard{--acc:var(--primary);width:min(560px,100%);background:var(--surface);border:1px solid var(--border);border-top:4px solid var(--acc);border-radius:20px;box-shadow:var(--e3);padding:22px 26px 20px;transition:border-color .3s}
  .acard[data-side=agency]{--acc:var(--advisory)}
  .pill2{display:flex;background:var(--neutral-sf);border-radius:999px;padding:4px;margin-bottom:18px}
  .pill2 button{flex:1;padding:10px;border-radius:999px;font-weight:800;font-size:13.5px;color:var(--ink2);display:flex;gap:8px;align-items:center;justify-content:center;transition:all .25s var(--ease)}
  .pill2 button.on{background:var(--surface);color:var(--acc);box-shadow:var(--e1)}
  .aslide{overflow:hidden}
  .atrack{display:flex;width:200%;transition:transform .35s var(--ease)}
  .atrack.ag{transform:translateX(-50%)}
  .apane{width:50%;padding:0 2px}
  .minitabs{display:flex;gap:18px;border-bottom:1.5px solid var(--border);margin-bottom:16px}
  .minitabs button{padding:9px 2px;font-weight:700;font-size:13.5px;color:var(--ink2);border-bottom:2.5px solid transparent;margin-bottom:-1.5px}
  .minitabs button.on{color:var(--acc);border-color:var(--acc)}
  .fld{margin-bottom:12px}
  .fld label{display:block;font-size:12px;font-weight:700;color:var(--ink2);margin-bottom:5px}
  .in{width:100%;min-height:46px;padding:0 13px;border:1.5px solid var(--border);border-radius:var(--r-m);background:var(--surface);font-size:14px}
  textarea.in{padding:11px 13px;min-height:70px;resize:vertical}
  .in:focus{outline:none;border-color:var(--acc);box-shadow:0 0 0 3px var(--primary-surface)}
  .acard[data-side=agency] .in:focus{box-shadow:0 0 0 3px var(--advisory-sf)}
  .pwwrap{position:relative}.pwwrap .toggle{position:absolute;right:5px;top:50%;transform:translateY(-50%);color:var(--ink2);width:34px;height:34px;display:grid;place-items:center;border-radius:8px}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border-radius:var(--r-m);background:var(--primary);color:#fff;font-weight:700;font-size:14px;transition:transform .12s var(--ease)}
  [data-theme=dark] .btn{color:#0B1420}
  .btn:active{transform:scale(.98)}.btn:disabled{opacity:.5;cursor:default}
  .btn.b2{background:var(--surface);color:var(--primary);border:1.5px solid var(--border)}
  .btn.g{background:transparent;color:var(--ink2)}
  .btn.d{background:var(--danger);color:#fff}[data-theme=dark] .btn.d{color:#2A0D08}
  .btn.adv{background:var(--advisory);color:#fff}[data-theme=dark] .btn.adv{color:#160B28}
  .btn.sm{min-height:34px;padding:0 13px;font-size:12.5px}.blk{width:100%}
  .agc{border:1.5px solid var(--advisory)!important;background:var(--advisory-sf)!important;color:var(--advisory)!important}
  .pwstr{display:flex;gap:5px;margin-top:7px}.pwstr i{height:4px;flex:1;border-radius:99px;background:var(--border)}.pwstr i.on{background:var(--success)}
  .alt{display:flex;gap:8px;align-items:center;margin-top:14px;font-size:13px;color:var(--ink2)}
  .alt b{color:var(--acc);cursor:pointer}
  .ahint{font-size:12px;color:var(--ink2);background:var(--neutral-sf);border-radius:var(--r-s);padding:9px 11px;margin:10px 0}
  .drow{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px dashed var(--border)}
  .drow .db{flex:1;min-width:150px;background:var(--neutral-sf);color:var(--ink);border:1.5px solid var(--border)}
  .drow .db small{display:block;font-weight:600;font-size:10.5px;color:var(--ink2)}
  .okbox{display:none;text-align:center;padding:18px 6px}
  .okbox.on{display:block}
  .okc{width:74px;height:74px;border-radius:50%;background:var(--success-sf);color:var(--success);display:grid;place-items:center;margin:0 auto 12px;animation:pop .5s var(--ease)}
  .okc.blue{background:var(--primary-surface);color:var(--primary)}
  .okc.vio{background:var(--advisory-sf);color:var(--advisory)}
  .okc svg{width:36px;height:36px}
  @keyframes pop{0%{transform:scale(0)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
  .guestlnk{display:block;width:100%;text-align:center;margin-top:16px;padding-top:14px;border-top:1px solid var(--border);font-size:13px;font-weight:700;color:var(--ink2)}
  .guestlnk b{color:var(--primary)}
</style>

<div class="view on" id="view-auth">
  <div>
    <div class="brand"><span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z"/><path d="m9 11.5 2 2 4-4.5"/></svg></span><b>RouteGuard</b><span>Road hazards, reported and routed around.</span></div>
    <div class="acard" id="acard" data-side={activeSide}>
      <div class="pill2">
        <button id="pillCom" class={activeSide === 'community' ? 'on' : ''} on:click={() => { activeSide = 'community'; }}>
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>Community
        </button>
        <button id="pillAg" class={activeSide === 'agency' ? 'on' : ''} on:click={() => { activeSide = 'agency'; }}>
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 20 5v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z"/><path d="m9 11.5 2 2 4-4.5"/></svg>Agency / LGU
        </button>
      </div>
      <div class="aslide"><div class="atrack" id="atrack">
                <div class="apane">
          <div class="minitabs"><button id="ctSign" class={activeTab === 'signin' ? 'on' : ''} on:click={() => { activeTab = 'signin'; }}>Sign in</button><button id="ctUp" class={activeTab === 'signup' ? 'on' : ''} on:click={() => { activeTab = 'signup'; }}>Sign up</button></div>
          <div id="mSign" style={activeTab === 'signin' ? 'display:block' : 'display:none'}>
            <div class="fld"><label for="signin-email">Email</label><input id="signin-email" class="in" type="email" bind:value={email} placeholder="you@email.com" required /></div>
            <div class="fld"><label for="signin-password">Password</label><div class="pwwrap"><input id="signin-password" class="in" bind:value={password} type={showPw ? 'text' : 'password'} placeholder="••••••••" required /><button type="button" class="toggle" aria-label={showPw ? 'Hide password' : 'Show password'} on:click={togglePasswordVisibility} > <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7s-3.5 7-10 7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
            {#if error}
              <div class="field-error">{error}</div>
            {/if}
            <button class="btn blk" on:click={login} disabled={loading}>
              {#if loading}
                Signing in...
              {:else}
                Sign in — instant access
              {/if}
            </button>
            <div class="alt">New here? <button on:click={() => { activeTab = 'signup'; }} class="link-button">Create a community account</button></div>
          </div>
          <div id="mUp" style={activeTab === 'signup' ? 'display:block' : 'display:none'}>
            <div class="fld"><label for="signup-fullname">Full name</label><input id="signup-fullname" class="in" type="text" bind:value={fullName} placeholder="Maria Santos" required /></div>
            <div class="fld"><label for="signup-email">Email</label><input id="signup-email" class="in" type="email" bind:value={email} placeholder="you@email.com" required /></div>
            <div class="fld"><label for="signup-password">Password</label>
              <div class="pwwrap">
                <input id="signup-password" class="in" bind:value={password} type={showPw ? 'text' : 'password'} placeholder="••••••••" required />
                <button type="button" class="toggle" aria-label={showPw ? 'Hide password' : 'Show password'} on:click={() => { showPw = !showPw; }}>
                  <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7s-3.5 7-10 7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              <div class="pwstr" id="pwstr"><i class={password.length >= 3 ? 'on' : ''}></i><i class={password.length >= 6 ? 'on' : ''}></i><i class={password.length >= 9 ? 'on' : ''}></i><i></i></div>
            </div>
            <div class="fld"><label for="signup-confirm-password">Confirm Password</label>
              <div class="pwwrap">
                <input id="signup-confirm-password" class="in" bind:value={confirmPassword} type={showConfirmPw ? 'text' : 'password'} placeholder="••••••••" required />
                <button type="button" class="toggle" aria-label={showConfirmPw ? 'Hide password' : 'Show password'} on:click={toggleConfirmPasswordVisibility} >
                  <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7s-3.5 7-10 7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            {#if error}
              <div class="field-error">{error}</div>
            {/if}
            <button class="btn blk" on:click={register} disabled={loading}>
              {#if loading}
                Creating account...
              {:else}
                Create account
              {/if}
            </button>
            <div class="okbox" id="upOk" style="display:none">
              <span class="okc blue"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></span><b>Check your email</b><p class="sub" style="margin:4px 0 12px">We sent a verification link to your inbox.</p><button class="btn blk" id="btnVerified">I've verified — enter RouteGuard</button>
            </div>
          </div>
          <div class="drow"><button class="btn b2 db" id="demoCom">⚡ Try demo account<small>Maria Santos · Community</small></button></div>
          <div class="guestlnk"><b>Continue as guest</b> — browse the map, no account needed</div>
        </div>
                <div class="apane">
          <div class="minitabs"><button id="agSign" class={activeTab === 'signin' ? 'on' : ''} on:click={() => { activeTab = 'signin'; }}>Sign in</button><button id="agReq" class={activeTab === 'request' ? 'on' : ''} on:click={() => { activeTab = 'request'; }}>Request access</button></div>
          <div id="aSign" style={activeTab === 'signin' ? 'display:block' : 'display:none'}>
            <div class="fld"><label for="agency-signin-email">Email</label><input id="agency-signin-email" class="in" type="email" bind:value={email} placeholder="k.bautista@tacloban.gov.ph" required /></div>
            <div class="fld"><label for="agency-signin-password">Password</label><div class="pwwrap"><input id="agency-signin-password" class="in" bind:value={password} type={showPw ? 'text' : 'password'} placeholder="••••••••" required /><button type="button" class="toggle" aria-label={showPw ? 'Hide password' : 'Show password'} on:click={togglePasswordVisibility} > <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7s-3.5 7-10 7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
            {#if error}
              <div class="field-error">{error}</div>
            {/if}
            <button class="btn adv blk" on:click={login} disabled={loading}>
              {#if loading}
                Signing in...
              {:else}
                Sign in with agency credentials
              {/if}
            </button>
            <div class="ahint">🏛 Agency & admin accounts are verified by an administrator — there is no instant signup. <b>Administrators sign in here too</b> and land in the Admin Console.</div>
          </div>
          <div id="aReq" style={activeTab === 'request' ? 'display:block' : 'display:none'}>
            <div class="fld"><label for="agency-full-name">Full name</label><input id="agency-full-name" class="in" type="text" bind:value={agencyRequestData.full_name} placeholder="Kevin T. Bautista" required /></div>
            <div class="fld"><label for="agency-organization">Agency/Organization:</label><input id="agency-organization" class="in" type="text" bind:value={agencyRequestData.agency} placeholder="City Government of Tacloban" required /></div>
            <div class="fld"><label for="agency-role">Role/Position:</label><input id="agency-role" class="in" type="text" bind:value={agencyRequestData.role} placeholder="Traffic Aide" required /></div>
            <div class="fld"><label for="agency-id-number">Agency ID number (optional):</label><input id="agency-id-number" class="in" type="text" bind:value={agencyRequestData.id_number} placeholder="CEO-00482" /></div>
            <div class="fld"><label for="agency-purpose">Purpose/Reason for Request:</label><textarea id="agency-purpose" class="in" bind:value={agencyRequestData.purpose} rows="4" placeholder="Hazard verification and road advisories along city routes." required></textarea></div>
            {#if agencyRequestError}
              <div class="field-error">{agencyRequestError}</div>
            {/if}
            {#if agencyRequestSuccess}
              <div class="okbox" style="display:block">
              </div>
            {/if}
            <button class="btn adv blk" on:click={handleAgencyRequestSubmit} disabled={agencyRequestLoading}>
              {#if agencyRequestLoading}
                Submitting...
              {:else}
                Submit request for review
              {/if}
            </button>
          </div>
          <div class="drow">
            <button class="btn b2 db" id="demoAg">⚡ Try demo<small>Kevin Bautista · LGU Agency</small></button>
            <button class="btn b2 db" id="demoAdm">⚡ Try demo<small>R. Villanueva · Admin</small></button>
          </div>
        </div>
      </div></div>
    </div>
    <button class="guestlnk" id="guestBtn">Just visiting? <b>Continue as guest</b> — browse the map, no account needed</button>
  </div>
</div>