<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { pb } from '$lib/pb';
  import { toasts } from '$lib/stores';
  import type { Contact } from '$lib/types';

  interface OrgGroup {
    id: string;
    name: string;
    count: number;
    cities: string[];
  }

  let orgs: OrgGroup[] = [];
  let loading = true;
  let search = '';
  let filterCity = ''; // '' = all cities

  onMount(async () => {
    try {
      // Organisations are their own records now, so the display name is simply
      // the org's name — no reconciling of rival spellings. A contact belonging
      // to several orgs counts towards each of them.
      const items = await pb.collection('contacts').getFullList<Contact>({
        // No "has an org" clause: PocketBase cannot express emptiness on a
        // multi-relation (`orgs != ''` matches every row). Contacts without an
        // organisation simply contribute nothing to the grouping below.
        filter: "deleted_at = null",
        expand: 'orgs',
        batch: 500,
      });

      const groups = new Map<string, { name: string; count: number; cities: Set<string> }>();
      for (const contact of items) {
        for (const org of contact.expand?.orgs ?? []) {
          if (!groups.has(org.id)) groups.set(org.id, { name: org.name, count: 0, cities: new Set() });
          const g = groups.get(org.id)!;
          g.count += 1;
          if (contact.city) g.cities.add(String(contact.city));
        }
      }

      orgs = [...groups.entries()]
        .map(([id, g]) => ({ id, name: g.name, count: g.count, cities: [...g.cities].sort() }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    } catch {
      toasts.error('Failed to load organisations');
    } finally {
      loading = false;
    }
  });

  // A search matches an org by its own name, or by any linked contact
  // (name/email/mobile/city) or activity note on those contacts.
  //
  // The contact query deliberately omits the org name: matching on it there
  // would drag in a contact's *unrelated* orgs too, so that searching "gnome"
  // also listed the employer of everyone at GNOME. Org names are matched
  // separately against the roster we already have.
  let matchIds: Set<string> | null = null; // null = no active search
  let debounceTimer: ReturnType<typeof setTimeout>;
  let searchSeq = 0; // drop a slow search response if a newer one started

  async function runSearch() {
    const q = search.trim();
    if (!q) {
      matchIds = null;
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const seq = ++searchSeq;
      const esc = q.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const byName = orgs.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())).map((o) => o.id);
      try {
        // getFullList so an org isn't missed from search results past 500 matches.
        const items = await pb.collection('contacts').getFullList<Contact>({
          filter:
            `deleted_at = null && ` +
            `(name ~ '${esc}' || email ~ '${esc}' || mobile ~ '${esc}' || city ~ '${esc}' || activities_via_contacts.notes ?~ '${esc}')`,
          expand: 'orgs',
          batch: 500,
        });
        if (seq !== searchSeq) return; // superseded by a newer search
        const viaContacts = items.flatMap((c) => (c.expand?.orgs ?? []).map((o) => o.id));
        matchIds = new Set([...byName, ...viaContacts]);
      } catch {
        if (seq === searchSeq) matchIds = new Set(byName);
      }
    }, 300);
  }

  $: search, runSearch();
  // All cities across the network, for the filter dropdown.
  $: allCities = [...new Set(orgs.flatMap((o) => o.cities))].sort((a, b) => a.localeCompare(b));
  $: shown = (matchIds === null ? orgs : orgs.filter((o) => matchIds!.has(o.id)))
    .filter((o) => !filterCity || o.cities.includes(filterCity));
</script>

<svelte:head>
  <title>Organisations · Rolodex</title>
</svelte:head>

<div class="px-6 py-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">Organisations</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
        {loading ? '—' : shown.length} organisations in the network
      </p>
    </div>
  </div>

  <!-- Search + filter -->
  <div class="flex flex-wrap items-center gap-3 mb-6">
    <div class="relative flex-1 max-w-md">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input type="search" bind:value={search} placeholder="Search org, contact, activity notes…" class="input pl-9 pr-8" />
      {#if !search}
        <kbd class="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-[11px] text-neutral-400 dark:text-neutral-500">/</kbd>
      {/if}
    </div>
    <select bind:value={filterCity} class="input w-auto" title="Filter by city" aria-label="Filter by city">
      <option value="">All cities</option>
      {#each allCities as city (city)}
        <option value={city}>{city}</option>
      {/each}
    </select>
    {#if filterCity}
      <button on:click={() => (filterCity = '')} class="btn-ghost text-sm">Clear</button>
    {/if}
  </div>

  {#if loading}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each Array(8) as _}
        <div class="card p-4 animate-pulse space-y-2">
          <div class="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-2/3"></div>
          <div class="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-1/3"></div>
        </div>
      {/each}
    </div>
  {:else if shown.length === 0}
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <div class="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <svg class="text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>
        </svg>
      </div>
      <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {search || filterCity ? 'No organisations match your filters' : 'No organisations yet'}
      </p>
      <p class="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
        {search || filterCity ? 'Try a different search term or city' : 'Organisations appear as contacts are added'}
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each shown as org (org.id)}
        <a
          href="{base}/orgs/{encodeURIComponent(org.name)}"
          class="card p-4 transition-all duration-150 hover:shadow-md hover:border-neutral-200 dark:hover:border-neutral-700 group"
        >
          <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-accent dark:group-hover:text-accent-dark transition-colors">
            {org.name}
          </p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {org.count} {org.count === 1 ? 'contact' : 'contacts'}
          </p>
          {#if org.cities.length}
            <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-2 flex items-center gap-1 truncate">
              <svg class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {org.cities.join(', ')}
            </p>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>
