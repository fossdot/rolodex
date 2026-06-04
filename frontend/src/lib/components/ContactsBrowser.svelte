<script lang="ts">
  import { onMount } from 'svelte';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { Contact } from '$lib/types';
  import { FU_ROLES, TOPICS } from '$lib/constants';
  import Avatar from '$lib/components/Avatar.svelte';
  import CityInput from '$lib/components/CityInput.svelte';

  /** 'mine' = only contacts added by the current user; 'all' = the full network */
  export let scope: 'mine' | 'all' = 'all';
  export let title = 'Contacts';
  export let subtitle = 'people in your network';

  let contacts: Contact[] = [];
  let loading = true;
  let search = '';
  let filterRoles: string[] = [];
  let filterTopics: string[] = [];
  let filterCity = '';
  let showFilters = false;
  let viewMode: 'grid' | 'list' = 'grid';
  let showDeleted = false;

  async function loadContacts() {
    loading = true;
    try {
      const isAdmin = $currentUser?.role === 'admin';
      const filters: string[] = [showDeleted && isAdmin ? 'deleted_at != null' : 'deleted_at = null'];
      if (scope === 'mine' && $currentUser?.id) {
        filters.push(`added_by = '${$currentUser.id}'`);
      }
      if (search.trim()) {
        const q = search.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        filters.push(`(name ~ '${q}' || org ~ '${q}' || email ~ '${q}' || mobile ~ '${q}' || city ~ '${q}')`);
      }
      if (filterCity.trim()) {
        const c = filterCity.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        filters.push(`city ~ '${c}'`);
      }
      if (filterRoles.length) {
        const rf = filterRoles.map((r) => `fu_roles ~ '${r}'`).join(' || ');
        filters.push(`(${rf})`);
      }
      if (filterTopics.length) {
        const tf = filterTopics.map((t) => `topics ~ '${t}'`).join(' || ');
        filters.push(`(${tf})`);
      }

      const result = await pb.collection('contacts').getList<Contact>(1, 200, {
        filter: filters.join(' && ') || '',
        sort: '-created',
        expand: showDeleted ? 'added_by,deleted_by' : 'added_by',
      });
      contacts = result.items;
    } catch (e) {
      toasts.error('Failed to load contacts');
    } finally {
      loading = false;
    }
  }

  onMount(loadContacts);

  let debounceTimer: ReturnType<typeof setTimeout>;
  function debounce(fn: () => void, ms = 300) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
  }

  $: search, filterRoles, filterTopics, filterCity, showDeleted, debounce(loadContacts);

  async function restoreContact(id: string) {
    try {
      await pb.collection('contacts').update(id, { deleted_at: '', deleted_by: '' });
      contacts = contacts.filter((c) => c.id !== id);
      toasts.success('Contact restored');
    } catch {
      toasts.error('Failed to restore contact');
    }
  }

  function toggleRole(v: string) {
    filterRoles = filterRoles.includes(v) ? filterRoles.filter((r) => r !== v) : [...filterRoles, v];
  }
  function toggleTopic(v: string) {
    filterTopics = filterTopics.includes(v) ? filterTopics.filter((t) => t !== v) : [...filterTopics, v];
  }
  function clearFilters() {
    search = '';
    filterRoles = [];
    filterTopics = [];
    filterCity = '';
    showDeleted = false;
  }

  $: activeFilters = filterRoles.length + filterTopics.length + (filterCity ? 1 : 0);

  function displayName(c: Contact) {
    return c.name || c.org || 'Unknown';
  }

  // Resolves a role value to its display label; 'other' shows the contact's custom text.
  function roleBadge(c: Contact, value: string) {
    if (value === 'other') return c.fu_roles_other || 'Other';
    return FU_ROLES.find((r) => r.value === value)?.label ?? value;
  }
</script>

<div class="px-6 py-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">{title}</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
        {loading ? '—' : contacts.length} {showDeleted ? 'deleted contacts' : subtitle}
      </p>
    </div>
    <a href="/contacts/new" class="btn-primary">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M12 5v14"/>
      </svg>
      Add Contact
    </a>
  </div>

  <!-- Search + Filter bar -->
  <div class="flex items-center gap-3 mb-4">
    <div class="relative flex-1 max-w-md">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        type="search"
        bind:value={search}
        placeholder="Search name, org, email, mobile, city…"
        class="input pl-9"
      />
    </div>

    <button
      on:click={() => (showFilters = !showFilters)}
      class="btn-secondary gap-2 {activeFilters ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark' : ''}"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      Filter
      {#if activeFilters}
        <span class="w-4 h-4 bg-accent dark:bg-accent-dark text-white text-[10px] font-bold rounded-full flex items-center justify-center">{activeFilters}</span>
      {/if}
    </button>

    {#if $currentUser?.role === 'admin'}
      <button
        on:click={() => (showDeleted = !showDeleted)}
        class="btn-secondary gap-2 {showDeleted ? 'border-red-400 dark:border-red-600 text-red-600 dark:text-red-400' : ''}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
        {showDeleted ? 'Showing Deleted' : 'Deleted'}
      </button>
    {/if}

    <!-- View toggle -->
    <div class="flex border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      <button
        on:click={() => (viewMode = 'grid')}
        class="px-2.5 py-2 transition-colors {viewMode === 'grid' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}"
        title="Grid view"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
        </svg>
      </button>
      <button
        on:click={() => (viewMode = 'list')}
        class="px-2.5 py-2 transition-colors {viewMode === 'list' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}"
        title="List view"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Filter panel -->
  {#if showFilters}
    <div class="card p-5 mb-4 animate-fade-in">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label for="filter-city" class="label">City</label>
          <CityInput id="filter-city" bind:value={filterCity} placeholder="e.g. Bangalore" />
        </div>

        <div>
          <span class="label">Roles</span>
          <div class="flex flex-wrap gap-1.5 mt-1">
            {#each FU_ROLES as role}
              <button
                on:click={() => toggleRole(role.value)}
                class="px-2.5 py-1 rounded-md text-xs font-medium border transition-all
                  {filterRoles.includes(role.value)
                    ? 'bg-accent dark:bg-accent-dark text-white border-accent dark:border-accent-dark'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'}"
              >
                {role.label}
              </button>
            {/each}
          </div>
        </div>

        <div>
          <span class="label">Topics</span>
          <div class="flex flex-wrap gap-1.5 mt-1">
            {#each TOPICS as topic}
              <button
                on:click={() => toggleTopic(topic.value)}
                class="px-2.5 py-1 rounded-md text-xs font-medium border transition-all
                  {filterTopics.includes(topic.value)
                    ? 'bg-accent dark:bg-accent-dark text-white border-accent dark:border-accent-dark'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'}"
              >
                {topic.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      {#if activeFilters}
        <div class="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
          <button on:click={clearFilters} class="btn-ghost text-sm">Clear all filters</button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Loading -->
  {#if loading}
    <div class="{viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}">
      {#each Array(8) as _}
        <div class="card p-4 animate-pulse">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800"></div>
            <div class="space-y-1.5 flex-1">
              <div class="h-3.5 bg-neutral-100 dark:bg-neutral-800 rounded w-3/4"></div>
              <div class="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2"></div>
            </div>
          </div>
          <div class="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-2/3"></div>
        </div>
      {/each}
    </div>

  <!-- Empty state -->
  {:else if contacts.length === 0}
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <div class="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <svg class="text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {search || activeFilters ? 'No contacts match your search' : 'No contacts yet'}
      </p>
      <p class="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
        {search || activeFilters ? 'Try adjusting your filters' : 'Add your first contact to get started'}
      </p>
      {#if !search && !activeFilters}
        <a href="/contacts/new" class="btn-primary mt-4">Add Contact</a>
      {:else}
        <button on:click={clearFilters} class="btn-secondary mt-4">Clear filters</button>
      {/if}
    </div>

  <!-- Grid view -->
  {:else if viewMode === 'grid'}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each contacts as contact (contact.id)}
        <div class="card p-4 transition-all duration-150 {contact.deleted_at ? 'opacity-70 border-red-200 dark:border-red-900' : 'hover:shadow-md hover:border-neutral-200 dark:hover:border-neutral-700'}">
          <a href="/contacts/{contact.id}" class="group block">
            <div class="flex items-start gap-3 mb-3">
              <Avatar name={displayName(contact)} />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-accent dark:group-hover:text-accent-dark transition-colors">
                  {contact.name || '—'}
                </p>
                {#if contact.org}
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{contact.org}</p>
                {/if}
                {#if contact.designation}
                  <p class="text-xs text-neutral-400 dark:text-neutral-500 truncate">{contact.designation}</p>
                {/if}
              </div>
            </div>

            {#if contact.city || contact.country}
              <p class="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mb-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {[contact.city, contact.country].filter(Boolean).join(', ')}
              </p>
            {/if}

            <div class="flex flex-wrap gap-1">
              {#if contact.deleted_at}
                <span class="badge bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">Deleted</span>
              {/if}
              {#each (contact.fu_roles ?? []).slice(0, contact.deleted_at ? 1 : 2) as role}
                <span class="badge-green">{roleBadge(contact, role)}</span>
              {/each}
              {#if (contact.fu_roles?.length ?? 0) > 2}
                <span class="badge-neutral">+{contact.fu_roles.length - 2}</span>
              {/if}
            </div>

            {#if scope === 'all' && contact.expand?.added_by}
              <p class="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2.5">
                Added by {contact.expand.added_by.name || contact.expand.added_by.email || '?'}
              </p>
            {/if}
          </a>
          {#if contact.deleted_at}
            <div class="mt-2.5 pt-2.5 border-t border-red-100 dark:border-red-900 flex items-center justify-between">
              <p class="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
                by {contact.expand?.deleted_by?.name || contact.expand?.deleted_by?.email || '?'}
              </p>
              <button on:click={() => restoreContact(contact.id)} class="text-xs text-accent dark:text-accent-dark hover:underline shrink-0 ml-2">Restore</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>

  <!-- List view -->
  {:else}
    <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
      {#each contacts as contact (contact.id)}
        <div class="flex items-center gap-4 px-4 py-3 {contact.deleted_at ? 'opacity-70' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'} transition-colors group">
          <a href="/contacts/{contact.id}" class="flex items-center gap-4 flex-1 min-w-0">
          <Avatar name={displayName(contact)} size="sm" />
          <div class="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
            <div class="min-w-0 col-span-1">
              <div class="flex items-center gap-1.5">
                <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate group-hover:text-accent dark:group-hover:text-accent-dark transition-colors">
                  {contact.name || '—'}
                </p>
                {#if contact.deleted_at}
                  <span class="badge bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 shrink-0">Deleted</span>
                {/if}
              </div>
              {#if contact.org}
                <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{contact.org}</p>
              {/if}
            </div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate col-span-1">{contact.designation || '—'}</p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate col-span-1">
              {[contact.city, contact.country].filter(Boolean).join(', ') || '—'}
            </p>
            <div class="flex flex-wrap gap-1 col-span-1">
              {#each (contact.fu_roles ?? []).slice(0, 2) as role}
                <span class="badge-neutral">{roleBadge(contact, role)}</span>
              {/each}
              {#if (contact.fu_roles?.length ?? 0) > 2}
                <span class="badge-neutral">+{contact.fu_roles.length - 2}</span>
              {/if}
            </div>
          </div>
          <svg class="text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          </a>
          {#if contact.deleted_at}
            <button on:click={() => restoreContact(contact.id)} class="btn-secondary text-xs py-1.5 shrink-0 ml-2">Restore</button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
