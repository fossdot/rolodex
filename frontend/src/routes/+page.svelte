<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { currentUser } from '$lib/stores';
  import { onMount } from 'svelte';

  onMount(() => {
    goto(`${base}${$currentUser ? '/contacts' : '/login'}`);
  });
</script>
