<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentUser, theme } from '$lib/stores';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toasts from '$lib/components/Toasts.svelte';
  import '../app.css';

  const publicRoutes = ['/login', '/reset-password'];
  $: isPublic = publicRoutes.some((r) => $page.url.pathname === r || $page.url.pathname.startsWith(r + '/'));

  onMount(() => {
    theme.init();
  });

  // Redirect logic
  $: if (typeof window !== 'undefined') {
    if (!$currentUser && !isPublic) {
      goto('/login');
    } else if ($currentUser && $page.url.pathname === '/login') {
      goto('/contacts');
    }
  }
</script>

{#if isPublic}
  <slot />
{:else if $currentUser}
  <div class="flex h-screen bg-white dark:bg-neutral-950 overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>
  </div>
{:else}
  <!-- Loading / redirecting -->
  <div class="h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
    <div class="w-5 h-5 border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100 rounded-full animate-spin"></div>
  </div>
{/if}

<Toasts />
