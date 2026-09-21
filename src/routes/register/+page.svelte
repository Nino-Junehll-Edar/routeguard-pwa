<script lang="ts">
  import { supabase } from '$lib/supabaseClient'

  let email = ''
  let password = ''

  async function register() {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Check your email for confirmation link')
  }
</script>

<form on:submit|preventDefault={register}>
  <input type="email" bind:value={email} placeholder="Email" required />
  <input type="password" bind:value={password} placeholder="Password" required />
  <button type="submit">Register</button>
</form>