declare module '*.svelte' {
  import type { SvelteComponentTyped } from 'svelte';
  export default class IWP extends SvelteComponentTyped<{}, {}, {}> {}
}
