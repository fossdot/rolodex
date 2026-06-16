<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { Activity, User, Contact } from '$lib/types';
  import { ACTIVITY_TYPES } from '$lib/constants';
  import Avatar from '$lib/components/Avatar.svelte';

  let loading = true;

  let totalContacts = 0;
  let totalActivities = 0;
  let totalUsers = 0;

  let recentActivities: Activity[] = [];
  let leaderboard: { user: User; contacts: number; activities: number; score: number }[] = [];

  // Deleted contacts — viewing/restoring lives here (not in Contacts/Rolodex),
  // toggled by the red trash icon in the header.
  let showDeleted = false;
  let deletedContacts: Contact[] = [];
  let deletedLoading = false;

  async function loadDeleted() {
    deletedLoading = true;
    try {
      const r = await pb.collection('contacts').getList<Contact>(1, 200, {
        filter: 'deleted_at != null',
        sort: '-deleted_at',
        expand: 'added_by,deleted_by',
      });
      deletedContacts = r.items;
    } catch {
      toasts.error('Failed to load deleted contacts');
    } finally {
      deletedLoading = false;
    }
  }

  function toggleDeleted() {
    showDeleted = !showDeleted;
    if (showDeleted) loadDeleted();
  }

  async function restoreContact(id: string) {
    try {
      await pb.collection('contacts').update(id, { deleted_at: '', deleted_by: '' });
      deletedContacts = deletedContacts.filter((c) => c.id !== id);
      toasts.success('Contact restored');
    } catch {
      toasts.error('Failed to restore contact');
    }
  }

  // Custom date range — empty inputs mean "all time". Contacts are filtered
  // by when they were added (created); activities by when they happened (date),
  // matching the Activities page.
  let startDate = '';
  let endDate = '';

  // Month + Year quick filters. Year alone = whole year; Month + Year = that
  // month. Custom From/To pickers are tucked behind the calendar toggle and
  // clear the selects when edited by hand.
  let monthSel = ''; // '01'…'12'
  let yearSel = '';
  let showCustom = false;

  const MONTHS = [
    ['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'],
    ['05', 'May'], ['06', 'June'], ['07', 'July'], ['08', 'August'],
    ['09', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
  ];

  const THIS_YEAR = new Date().getFullYear();
  const YEARS = Array.from({ length: 4 }, (_, i) => String(THIS_YEAR - i));

  function applyMonthYear() {
    if (!monthSel && !yearSel) {
      startDate = '';
      endDate = '';
      return;
    }
    if (monthSel && !yearSel) yearSel = String(THIS_YEAR); // month implies a year
    if (monthSel) {
      const lastDay = new Date(Number(yearSel), Number(monthSel), 0).getDate();
      startDate = `${yearSel}-${monthSel}-01`;
      endDate = `${yearSel}-${monthSel}-${String(lastDay).padStart(2, '0')}`;
    } else {
      startDate = `${yearSel}-01-01`;
      endDate = `${yearSel}-12-31`;
    }
  }

  function onManualDateInput() {
    monthSel = '';
    yearSel = '';
  }

  function clearRange() {
    startDate = '';
    endDate = '';
    monthSel = '';
    yearSel = '';
    showCustom = false;
  }

  function contactsRangeFilter() {
    const parts: string[] = [];
    if (startDate) parts.push(`created >= '${startDate} 00:00:00'`);
    if (endDate) parts.push(`created <= '${endDate} 23:59:59'`);
    return parts.join(' && ');
  }

  function activitiesRangeFilter() {
    const parts: string[] = [];
    if (startDate) parts.push(`date >= '${startDate} 00:00:00'`);
    if (endDate) parts.push(`date <= '${endDate} 23:59:59'`);
    return parts.join(' && ');
  }

  function withRange(base: string, range: string) {
    return range ? `${base} && ${range}` : base;
  }

  async function load() {
    if ($currentUser?.role !== 'admin') {
      goto('/contacts');
      return;
    }
    loading = true;
    try {
      const cRange = contactsRangeFilter();
      const aRange = activitiesRangeFilter();

      const [contactsRes, activitiesRes, usersRes, recentRes] = await Promise.all([
        pb.collection('contacts').getList(1, 1, { filter: withRange('deleted_at = null', cRange) }),
        pb.collection('activities').getList(1, 1, { filter: withRange('deleted_at = null', aRange) }),
        pb.collection('users').getList<User>(1, 200),
        pb.collection('activities').getList<Activity>(1, 15, {
          sort: '-date,-created',
          expand: 'logged_by,contact',
          filter: withRange('deleted_at = null', aRange),
        }),
      ]);

      totalContacts = contactsRes.totalItems;
      totalActivities = activitiesRes.totalItems;
      totalUsers = usersRes.totalItems;
      recentActivities = recentRes.items;

      // Build leaderboard over the same range
      const users = usersRes.items;
      const board = await Promise.all(
        users.map(async (u) => {
          const [c, a] = await Promise.all([
            pb.collection('contacts').getList(1, 1, {
              filter: withRange(`added_by = '${u.id}' && deleted_at = null`, cRange),
            }),
            pb.collection('activities').getList(1, 1, {
              filter: withRange(`logged_by = '${u.id}' && deleted_at = null`, aRange),
            }),
          ]);
          return { user: u, contacts: c.totalItems, activities: a.totalItems, score: c.totalItems * 1 + a.totalItems * 2 };
        })
      );
      leaderboard = board.sort((a, b) => b.score - a.score);
    } catch {
      toasts.error('Failed to load dashboard');
    } finally {
      loading = false;
    }
  }

  onMount(load);

  let debounceTimer: ReturnType<typeof setTimeout>;
  let initialised = false;
  $: {
    // debounce re-loads when the date inputs change (skip the initial run —
    // onMount already loads)
    startDate, endDate;
    if (initialised) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, 300);
    } else {
      initialised = true;
    }
  }

  function getActivityLabel(v: string) { return ACTIVITY_TYPES.find((a) => a.value === v)?.label ?? v; }

  function formatDate(d: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Admin · Rolodex</title>
</svelte:head>

{#if $currentUser?.role !== 'admin'}
  <div class="flex items-center justify-center h-64 text-neutral-500 dark:text-neutral-400 text-sm">
    Access restricted to administrators.
  </div>
{:else}
  <div class="px-6 py-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">{showDeleted ? 'Deleted Contacts' : 'Dashboard'}</h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          {#if showDeleted}Soft-deleted contacts — restore to bring them back{:else}Network engagement {startDate || endDate ? 'in the selected period' : 'overview · all time'}{/if}
        </p>
      </div>

      <div class="flex items-start gap-2">
        {#if !showDeleted}
        <!-- Date range filter — drives the stats and the leaderboard -->
        <div class="flex flex-col items-end gap-2">
        <div class="flex items-center gap-2">
          <select
            bind:value={monthSel}
            on:change={applyMonthYear}
            class="input py-1.5 text-sm w-auto"
            title="Month"
          >
            <option value="">Month</option>
            {#each MONTHS as [v, label] (v)}
              <option value={v}>{label}</option>
            {/each}
          </select>
          <select
            bind:value={yearSel}
            on:change={applyMonthYear}
            class="input py-1.5 text-sm w-auto"
            title="Year"
          >
            <option value="">Year</option>
            {#each YEARS as y (y)}
              <option value={y}>{y}</option>
            {/each}
          </select>
          <button
            on:click={() => (showCustom = !showCustom)}
            class="btn-ghost p-2 {showCustom ? 'text-accent dark:text-accent-dark' : 'text-neutral-400'}"
            title="Custom date range"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </button>
          {#if startDate || endDate}
            <button on:click={clearRange} class="btn-ghost text-xs py-2" title="Show all time">
              Clear
            </button>
          {/if}
        </div>
        {#if showCustom}
          <div class="flex items-center gap-2 animate-fade-in">
            <input type="date" bind:value={startDate} on:input={onManualDateInput} class="input py-1.5 text-xs w-auto" title="From" />
            <span class="text-xs text-neutral-400">→</span>
            <input type="date" bind:value={endDate} on:input={onManualDateInput} class="input py-1.5 text-xs w-auto" title="To" />
          </div>
        {/if}
        </div>
        {/if}
        <!-- View / restore deleted contacts -->
        <button
          on:click={toggleDeleted}
          class="p-2 rounded-lg border transition-colors shrink-0 {showDeleted
            ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
            : 'border-neutral-200 dark:border-neutral-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950'}"
          title={showDeleted ? 'Back to dashboard' : 'View deleted contacts'}
          aria-label={showDeleted ? 'Back to dashboard' : 'View deleted contacts'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>

    {#if showDeleted}
      <!-- Deleted contacts list -->
      {#if deletedLoading}
        <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
          {#each Array(5) as _}
            <div class="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div class="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"></div>
              <div class="flex-1 space-y-1.5">
                <div class="h-3.5 bg-neutral-100 dark:bg-neutral-800 rounded w-1/3"></div>
                <div class="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if deletedContacts.length === 0}
        <div class="card flex flex-col items-center justify-center py-16 text-center">
          <div class="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
            <svg class="text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </div>
          <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">No deleted contacts</p>
          <p class="text-sm text-neutral-400 dark:text-neutral-500 mt-1">Deleted contacts will appear here for restoring</p>
        </div>
      {:else}
        <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
          {#each deletedContacts as c (c.id)}
            <div class="flex items-center gap-3 px-3 sm:px-4 py-3">
              <Avatar name={c.name || c.org || '?'} size="sm" />
              <div class="flex-1 min-w-0">
                <a href="/contacts/{c.id}" class="text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-accent dark:hover:text-accent-dark truncate block">
                  {c.name || c.org || 'Unknown'}
                </a>
                <p class="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                  {c.org ? c.org + ' · ' : ''}deleted by {c.expand?.deleted_by?.name || c.expand?.deleted_by?.email || '?'} on {formatDate(c.deleted_at ?? '')}
                </p>
              </div>
              <button on:click={() => restoreContact(c.id)} class="btn-secondary text-xs py-1.5 shrink-0">Restore</button>
            </div>
          {/each}
        </div>
      {/if}
    {:else if loading}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {#each Array(3) as _}
          <div class="card p-5 animate-pulse">
            <div class="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2 mb-3"></div>
            <div class="h-8 bg-neutral-100 dark:bg-neutral-800 rounded w-1/3"></div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Stats: one compact strip on phones, three cards from sm: up -->
      <div class="card grid grid-cols-3 divide-x divide-neutral-100 dark:divide-neutral-800 mb-6 sm:hidden">
        <div class="px-2 py-3 text-center">
          <p class="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-medium mb-1">Contacts</p>
          <p class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">{totalContacts}</p>
        </div>
        <div class="px-2 py-3 text-center">
          <p class="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-medium mb-1">Activities</p>
          <p class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">{totalActivities}</p>
        </div>
        <div class="px-2 py-3 text-center">
          <p class="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-medium mb-1">Team</p>
          <p class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">{totalUsers}</p>
        </div>
      </div>
      <div class="hidden sm:grid sm:grid-cols-3 gap-4 mb-6">
        <div class="card p-5">
          <p class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-medium mb-2">Total Contacts</p>
          <p class="text-3xl font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">{totalContacts}</p>
        </div>
        <div class="card p-5">
          <p class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-medium mb-2">Activities Logged</p>
          <p class="text-3xl font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">{totalActivities}</p>
        </div>
        <div class="card p-5">
          <p class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-medium mb-2">Team Members</p>
          <p class="text-3xl font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">{totalUsers}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <!-- Leaderboard -->
        <div class="lg:col-span-3">
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Team Engagement
            <span class="text-xs text-neutral-400 dark:text-neutral-500 font-normal ml-1">— contacts added × 1 + activities logged × 2</span>
          </h2>
          <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
            {#each leaderboard as entry, i}
              <div class="flex items-center gap-2.5 sm:gap-4 px-3 sm:px-4 py-3">
                <span class="text-sm font-mono font-medium text-neutral-400 dark:text-neutral-500 w-5 text-right shrink-0">
                  {i + 1}
                </span>
                <Avatar name={entry.user.name || entry.user.email} size="sm" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {entry.user.name || entry.user.email}
                  </p>
                  <p class="text-xs text-neutral-400 dark:text-neutral-500 capitalize">{entry.user.role}</p>
                </div>
                <div class="flex items-center gap-3 sm:gap-4 text-right shrink-0">
                  <div>
                    <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">{entry.contacts}</p>
                    <p class="text-[10px] text-neutral-400">contacts</p>
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">{entry.activities}</p>
                    <p class="text-[10px] text-neutral-400">activities</p>
                  </div>
                  <div class="w-12">
                    <p class="text-base font-bold text-accent dark:text-accent-dark tabular-nums">{entry.score}</p>
                    <p class="text-[10px] text-neutral-400">score</p>
                  </div>
                </div>
              </div>
            {/each}
            {#if leaderboard.length === 0}
              <div class="px-4 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">No data yet</div>
            {/if}
          </div>
        </div>

        <!-- Recent activity feed -->
        <div class="lg:col-span-2">
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Recent Activities</h2>
          <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
            {#each recentActivities as act (act.id)}
              <div class="px-4 py-3">
                <div class="flex items-start gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent-dark mt-1.5 shrink-0"></div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                      {getActivityLabel(act.activity_type)}
                    </p>
                    {#if act.expand?.contact}
                      <a href="/contacts/{act.contact}" class="text-xs text-accent dark:text-accent-dark hover:underline truncate block">
                        {act.expand.contact.name || act.expand.contact.org || 'Unknown'}
                      </a>
                    {/if}
                    {#if act.event_name}
                      <p class="text-xs text-neutral-400 dark:text-neutral-500 truncate">{act.event_name}</p>
                    {/if}
                    <p class="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {act.expand?.logged_by?.name || act.expand?.logged_by?.email || 'Unknown'} · {formatDate(act.date)}
                    </p>
                  </div>
                </div>
              </div>
            {/each}
            {#if recentActivities.length === 0}
              <div class="px-4 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">No activities yet</div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
