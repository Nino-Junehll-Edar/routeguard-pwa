<script context="module">
  import { redirect } from '@sveltejs/kit';
  /** @type {import('./$types').PageLoad} */
  export function load({}) {
    // Redirect to map page
    throw redirect(302, '/map');
  }
</script>

<div>
  <h1>RouteGuard</h1>
  <p>Redirecting to map...</p>
</div>