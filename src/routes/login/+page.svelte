<script lang="ts">
  import { supabase } from '$lib/supabaseClient'

  let email = ''
  let password = ''

  async function login() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })

    if (error) {
      alert(error.message)
      return
    }
  }
</script>

<form on:submit|preventDefault={login}>
  <input type="email" bind:value={email} placeholder="Email" required />
  <input type="password" bind:value={password} placeholder="Password" required />
  <button type="submit">Login</button>
</form>