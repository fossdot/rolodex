<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentUser } from '$lib/stores';
  import { onMount } from 'svelte';

  onMount(() => {
    goto($currentUser ? '/contacts' : '/login');
  });
</script>
