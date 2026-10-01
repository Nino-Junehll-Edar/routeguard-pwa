<script context="module">
  export function load({}) {
    // Redirect to unified auth page
    return {
      status: 302,
      headers: {
        location: '/auth'
      }
    };
  }
</script>