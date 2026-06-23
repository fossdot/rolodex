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

  // Mobile navigation drawer — closes on any navigation
  let mobileNavOpen = false;
  $: $page.url.pathname, (mobileNavOpen = false);

  // Redirect logic
  $: if (typeof window !== 'undefined') {
    if (!$currentUser && !isPublic) {
      goto('/login');
    } else if ($currentUser && $page.url.pathname === '/login') {
      goto('/contacts');
    }
  }

  // ── Global keyboard shortcuts (only when signed in) ──────────────────────────
  //   /  or  Cmd/Ctrl+K → focus the page's search box
  //   n  or  Cmd/Ctrl+N → add a new contact
  // (Cmd+S is handled on the add/edit forms; we don't hijack Cmd+F — that's the
  //  browser's find-in-page.)
  function isTyping(el: EventTarget | null): boolean {
    const t = el as HTMLElement | null;
    if (!t) return false;
    return (
      t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable
    );
  }

  function focusSearch(): boolean {
    const el = document.querySelector<HTMLInputElement>('input[type="search"]');
    if (el) {
      el.focus();
      el.select();
      return true;
    }
    return false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (isPublic || !$currentUser) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (mod && key === 'k') {
      if (focusSearch()) e.preventDefault();
      return;
    }
    if (mod && key === 'n') {
      e.preventDefault(); // best-effort; some browsers reserve Cmd/Ctrl+N
      goto('/contacts/new');
      return;
    }
    if (isTyping(e.target) || mod) return; // bare-key shortcuts only when not editing
    if (e.key === '/') {
      if (focusSearch()) e.preventDefault();
    } else if (key === 'n') {
      goto('/contacts/new');
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if isPublic}
  <slot />
{:else if $currentUser}
  <div class="flex h-screen bg-white dark:bg-neutral-950 overflow-hidden">
    <!-- Desktop sidebar -->
    <div class="hidden md:block shrink-0">
      <Sidebar />
    </div>

    <!-- Mobile drawer -->
    {#if mobileNavOpen}
      <div class="fixed inset-0 z-50 md:hidden">
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="absolute inset-0 bg-black/40 animate-fade-in" on:click={() => (mobileNavOpen = false)}></div>
        <div class="absolute left-0 top-0 h-full shadow-2xl animate-fade-in">
          <Sidebar />
        </div>
      </div>
    {/if}

    <main class="flex-1 overflow-y-auto min-w-0">
      <!-- Mobile top bar -->
      <div class="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-3 px-4 py-3">
        <button
          on:click={() => (mobileNavOpen = true)}
          class="btn-ghost p-2 -ml-2"
          title="Menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>
          </svg>
        </button>
        <a href="/contacts" class="flex items-center gap-2">
          <img src="/logo-black.svg" alt="FOSS United" class="h-5 dark:hidden" />
          <img src="/logo-white.svg" alt="FOSS United" class="h-5 hidden dark:block" />
          <span class="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium tracking-widest uppercase">Rolodex</span>
        </a>
      </div>
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
