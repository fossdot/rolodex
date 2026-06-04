<script lang="ts">
  import { onMount } from 'svelte';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { Activity, Contact, User } from '$lib/types';
  import { ACTIVITY_TYPES } from '$lib/constants';
  import Avatar from '$lib/components/Avatar.svelte';

  type Period = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';
  let period: Period = 'month';
  let startDate = '';
  let endDate = '';

  let activities: Activity[] = [];
  let loading = true;
  let search = '';

  // Admin-only: filter activities by the user who logged them
  let users: User[] = [];
  let filterUser = '';
  $: isAdmin = $currentUser?.role === 'admin';

  async function loadUsers() {
    if (!isAdmin) return;
    try {
      const r = await pb.collection('users').getList<User>(1, 200, { sort: 'name' });
      users = r.items;
    } catch {
      /* non-fatal — picker just stays empty */
    }
  }

  const PERIODS: [Exclude<Period, 'custom'>, string][] = [
    ['week', 'This week'],
    ['month', 'This month'],
    ['quarter', 'This quarter'],
    ['year', 'This year'],
    ['all', 'All time'],
  ];

  function toYMD(d: Date) {
    return d.toISOString().split('T')[0];
  }

  function setPeriod(p: Exclude<Period, 'custom'>) {
    period = p;
    const now = new Date();
    endDate = p === 'all' ? '' : toYMD(now);
    const d = new Date();
    if (p === 'week') d.setDate(d.getDate() - 7);
    else if (p === 'month') d.setMonth(d.getMonth() - 1);
    else if (p === 'quarter') d.setMonth(d.getMonth() - 3);
    else if (p === 'year') d.setFullYear(d.getFullYear() - 1);
    startDate = p === 'all' ? '' : toYMD(d);
  }

  // Manually edited dates switch the toggle to custom
  function onDateInput() {
    period = 'custom';
  }

  async function load() {
    loading = true;
    try {
      const filters = ['deleted_at = null'];
      if (startDate) filters.push(`date >= '${startDate}'`);
      if (endDate) filters.push(`date <= '${endDate} 23:59:59'`);
      if (isAdmin && filterUser) filters.push(`logged_by = '${filterUser}'`);
      if (search.trim()) {
        const q = search.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        filters.push(`(event_name ~ '${q}' || notes ~ '${q}' || contact.name ~ '${q}' || contact.org ~ '${q}')`);
      }

      const result = await pb.collection('activities').getList<Activity>(1, 200, {
        filter: filters.join(' && '),
        sort: '-date,-created',
        expand: 'contact,logged_by',
      });
      activities = result.items;
    } catch {
      toasts.error('Failed to load activities');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    setPeriod('month');
    load();
    loadUsers();
  });

  let debounceTimer: ReturnType<typeof setTimeout>;
  function debounceLoad() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 300);
  }
  $: startDate, endDate, search, filterUser, debounceLoad();

  function getActivityLabel(v: string) {
    return ACTIVITY_TYPES.find((a) => a.value === v)?.label ?? v;
  }

  function formatDate(d: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  let expandedId: string | null = null;
  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  // Active contacts: rank contacts by number of activities in the loaded window
  $: activeContacts = Object.values(
    activities.reduce<Record<string, { contact: Contact; count: number; lastDate: string }>>((acc, a) => {
      const c = a.expand?.contact;
      if (!c) return acc;
      if (!acc[c.id]) acc[c.id] = { contact: c, count: 0, lastDate: '' };
      acc[c.id].count += 1;
      if (a.date > acc[c.id].lastDate) acc[c.id].lastDate = a.date;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  // Group activities by month for the timeline headers
  $: grouped = activities.reduce<Record<string, Activity[]>>((acc, a) => {
    const key = a.date
      ? new Date(a.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : 'Undated';
    (acc[key] ??= []).push(a);
    return acc;
  }, {});
</script>

<svelte:head>
  <title>Activities · Rolodex</title>
</svelte:head>

<div class="px-6 py-6 max-w-6xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
    <div>
      <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">Activities</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
        {loading ? '—' : `${activities.length} activities · ${activeContacts.length} active contacts`}
      </p>
    </div>

    <!-- Period toggle -->
    <div class="flex border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden text-sm">
      {#each PERIODS as [v, label]}
        <button
          on:click={() => setPeriod(v)}
          class="px-3 py-2 transition-colors {period === v
            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium'
            : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
        >
          {label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Search + custom date range -->
  <div class="flex items-end gap-3 mb-6 flex-wrap">
    <div class="relative flex-1 max-w-md min-w-48">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        type="search"
        bind:value={search}
        placeholder="Search event, notes, contact…"
        class="input pl-9"
      />
    </div>

    <div>
      <label for="start-date" class="label">From</label>
      <input id="start-date" type="date" bind:value={startDate} on:input={onDateInput} class="input" />
    </div>
    <div>
      <label for="end-date" class="label">To</label>
      <input id="end-date" type="date" bind:value={endDate} on:input={onDateInput} class="input" />
    </div>
    {#if isAdmin}
      <div>
        <label for="filter-user" class="label">Logged by</label>
        <select id="filter-user" bind:value={filterUser} class="input min-w-40">
          <option value="">All users</option>
          {#each users as u (u.id)}
            <option value={u.id}>{u.name || u.email || u.id}</option>
          {/each}
        </select>
      </div>
    {/if}
    {#if period === 'custom'}
      <span class="badge-green mb-2.5">Custom range</span>
    {/if}
  </div>

  {#if loading}
    <div class="space-y-2">
      {#each Array(6) as _}
        <div class="card p-4 animate-pulse flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"></div>
          <div class="space-y-1.5 flex-1">
            <div class="h-3.5 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2"></div>
            <div class="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-1/3"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if activities.length === 0}
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <div class="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <svg class="text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      </div>
      <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">No activities in this period</p>
      <p class="text-sm text-neutral-400 dark:text-neutral-500 mt-1">Try a wider date range</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- Activities timeline -->
      <div class="lg:col-span-3">
        {#each Object.entries(grouped) as [month, items]}
          <div class="mb-6">
            <h2 class="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 sticky top-0 bg-white dark:bg-neutral-950 py-1.5">
              {month} <span class="font-normal">· {items.length}</span>
            </h2>
            <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
              {#each items as act (act.id)}
                <div>
                  <!-- Collapsed row — click to expand -->
                  <button
                    type="button"
                    on:click={() => toggleExpand(act.id)}
                    class="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    <div class="w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent-dark mt-2 shrink-0"></div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-2">
                        <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {getActivityLabel(act.activity_type)}
                          {#if act.expand?.contact}
                            <span class="text-neutral-400 dark:text-neutral-500 font-normal">·</span>
                            <span class="text-accent dark:text-accent-dark font-normal">{act.expand.contact.name || act.expand.contact.org || 'Unknown'}</span>
                          {/if}
                        </p>
                        <span class="text-xs text-neutral-400 dark:text-neutral-500 shrink-0 flex items-center gap-1.5">
                          {formatDate(act.date)}
                          <svg class="transition-transform {expandedId === act.id ? 'rotate-180' : ''}" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        </span>
                      </div>
                      {#if act.event_name}
                        <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{act.event_name}</p>
                      {/if}
                    </div>
                  </button>

                  <!-- Expanded detail -->
                  {#if expandedId === act.id}
                    <div class="px-4 pb-4 pl-9 animate-fade-in">
                      <div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 space-y-3">
                        {#if act.notes}
                          <div>
                            <p class="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Notes</p>
                            <p class="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">{act.notes}</p>
                          </div>
                        {/if}
                        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                          {#if act.event_link}
                            <a href={act.event_link} target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 text-accent dark:text-accent-dark hover:underline">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                              </svg>
                              Event link
                            </a>
                          {/if}
                          {#if act.expand?.contact}
                            <a href="/contacts/{act.contact}" class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-accent dark:hover:text-accent-dark">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                              </svg>
                              View contact
                            </a>
                          {/if}
                          <span class="text-neutral-400 dark:text-neutral-500">
                            logged by {act.expand?.logged_by?.name || act.expand?.logged_by?.email || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <!-- Active contacts -->
      <div class="lg:col-span-2">
        <h2 class="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 py-1.5">
          Active Contacts <span class="font-normal">· {activeContacts.length}</span>
        </h2>
        <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
          {#each activeContacts as entry, i (entry.contact.id)}
            <a href="/contacts/{entry.contact.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors group">
              <span class="text-sm font-mono font-medium text-neutral-400 dark:text-neutral-500 w-5 text-right shrink-0">
                {i + 1}
              </span>
              <Avatar name={entry.contact.name || entry.contact.org || '?'} size="sm" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate group-hover:text-accent dark:group-hover:text-accent-dark transition-colors">
                  {entry.contact.name || entry.contact.org || 'Unknown'}
                </p>
                <p class="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                  last active {formatDate(entry.lastDate)}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-base font-bold text-accent dark:text-accent-dark tabular-nums">{entry.count}</p>
                <p class="text-[10px] text-neutral-400">{entry.count === 1 ? 'activity' : 'activities'}</p>
              </div>
            </a>
          {/each}
          {#if activeContacts.length === 0}
            <div class="px-4 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">No active contacts in this period</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
