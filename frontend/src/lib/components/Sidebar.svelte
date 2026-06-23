<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { currentUser, theme, toasts } from '$lib/stores';
  import Avatar from './Avatar.svelte';
  import ThemeToggle from './ThemeToggle.svelte';

  const navItems = [
    {
      href: '/contacts',
      label: 'My Contacts',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    },
    {
      href: '/rolodex',
      label: 'Rolodex',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    },
    {
      href: '/orgs',
      label: 'Organisations',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>`,
    },
    {
      href: '/activities',
      label: 'Activities',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    },
  ];

  async function logout() {
    pb.authStore.clear();
    await goto(`${base}/login`);
    toasts.success('Logged out successfully');
  }

  $: isAdmin = $currentUser?.role === 'admin';
  $: currentPath = $page.url.pathname;
</script>

<aside class="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-neutral-50 dark:bg-neutral-950 border-r border-neutral-100 dark:border-neutral-800">
  <!-- Logo -->
  <div class="px-5 py-5 border-b border-neutral-100 dark:border-neutral-800">
    <a href="{base}/contacts" class="flex items-center gap-2">
      <img src="{base}/logo-black.svg" alt="FOSS United" class="h-6 dark:hidden" />
      <img src="{base}/logo-white.svg" alt="FOSS United" class="h-6 hidden dark:block" />
    </a>
    <p class="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5 font-medium tracking-widest uppercase">Rolodex</p>
  </div>

  <!-- Nav -->
  <nav class="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
    {#each navItems as item}
      <a
        href={base + item.href}
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-100
          {currentPath.startsWith(base + item.href)
            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-100'}"
      >
        {@html item.icon}
        {item.label}
      </a>
    {/each}

    {#if isAdmin}
      <a
        href="{base}/admin"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-100
          {currentPath.startsWith(base + '/admin')
            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-100'}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
        </svg>
        Admin
      </a>
    {/if}
  </nav>

  <!-- Footer: import + user + theme -->
  <div class="px-3 py-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
    <a
      href="{base}/contacts/import"
      class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100
        {currentPath === base + '/contacts/import'
          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-100'}"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      </svg>
      Import Contacts
    </a>

    <div class="flex items-center gap-2 px-2 py-1.5">
      <Avatar name={$currentUser?.name || $currentUser?.email || ''} size="sm" />
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
          {$currentUser?.name || 'User'}
        </p>
        <p class="text-[10px] text-neutral-400 dark:text-neutral-500 truncate capitalize">
          {$currentUser?.role || 'employee'}
        </p>
      </div>
    </div>

    <div class="flex items-center gap-1 px-1">
      <ThemeToggle />
      <button
        on:click={logout}
        class="btn-ghost px-2.5 py-2 rounded-lg flex-1 justify-start text-xs text-neutral-500 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        title="Log out"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
        </svg>
        Log out
      </button>
    </div>
  </div>
</aside>
