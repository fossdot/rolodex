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
  let deletedContacts: Contact[] = [];

  // Custom date range — empty inputs mean "all time". Contacts are filtered
  // by when they were added (created); activities by when they happened (date),
  // matching the Activities page.
  let startDate = '';
  let endDate = '';

  // Quick month picker — selecting a month fills From/To with its bounds.
  // Editing the dates by hand clears the selection (range becomes custom).
  let monthSel = '';

  const MONTH_OPTIONS: { value: string; label: string }[] = (() => {
    const opts = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 36; i++) {
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      opts.push({ value, label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) });
      d.setMonth(d.getMonth() - 1);
    }
    return opts;
  })();

  function applyMonth() {
    if (!monthSel) return;
    const [y, m] = monthSel.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    startDate = `${monthSel}-01`;
    endDate = `${monthSel}-${String(lastDay).padStart(2, '0')}`;
  }

  function onManualDateInput() {
    monthSel = '';
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

      const [contactsRes, activitiesRes, usersRes, recentRes, deletedRes] = await Promise.all([
        pb.collection('contacts').getList(1, 1, { filter: withRange('deleted_at = null', cRange) }),
        pb.collection('activities').getList(1, 1, { filter: withRange('deleted_at = null', aRange) }),
        pb.collection('users').getList<User>(1, 200),
        pb.collection('activities').getList<Activity>(1, 15, {
          sort: '-date,-created',
          expand: 'logged_by,contact',
          filter: withRange('deleted_at = null', aRange),
        }),
        pb.collection('contacts').getList<Contact>(1, 50, {
          filter: 'deleted_at != null',
          sort: '-deleted_at',
          expand: 'deleted_by,added_by',
        }),
      ]);

      totalContacts = contactsRes.totalItems;
      totalActivities = activitiesRes.totalItems;
      totalUsers = usersRes.totalItems;
      recentActivities = recentRes.items;
      deletedContacts = deletedRes.items;

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

  async function restoreContact(contactId: string) {
    try {
      await pb.collection('contacts').update(contactId, { deleted_at: '', deleted_by: '' });
      deletedContacts = deletedContacts.filter((c) => c.id !== contactId);
      totalContacts += 1;
      toasts.success('Contact restored');
    } catch {
      toasts.error('Failed to restore contact');
    }
  }

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
        <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">Dashboard</h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          Network engagement {startDate || endDate ? 'in the selected period' : 'overview · all time'}
        </p>
      </div>
      <!-- Date range filter — drives the stats and the leaderboard -->
      <div class="flex items-end gap-3">
        <div>
          <label for="admin-month" class="label">Month</label>
          <select id="admin-month" bind:value={monthSel} on:change={applyMonth} class="input min-w-36">
            <option value="">Pick a month…</option>
            {#each MONTH_OPTIONS as m (m.value)}
              <option value={m.value}>{m.label}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="admin-start" class="label">From</label>
          <input id="admin-start" type="date" bind:value={startDate} on:input={onManualDateInput} class="input" />
        </div>
        <div>
          <label for="admin-end" class="label">To</label>
          <input id="admin-end" type="date" bind:value={endDate} on:input={onManualDateInput} class="input" />
        </div>
        {#if startDate || endDate}
          <button
            on:click={() => { startDate = ''; endDate = ''; monthSel = ''; }}
            class="btn-ghost text-xs py-2.5"
            title="Show all time"
          >
            Clear
          </button>
        {/if}
      </div>
    </div>

    {#if loading}
      <div class="grid grid-cols-3 gap-4 mb-6">
        {#each Array(3) as _}
          <div class="card p-5 animate-pulse">
            <div class="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2 mb-3"></div>
            <div class="h-8 bg-neutral-100 dark:bg-neutral-800 rounded w-1/3"></div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
              <div class="flex items-center gap-4 px-4 py-3">
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
                <div class="flex items-center gap-4 text-right shrink-0">
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
      {#if deletedContacts.length > 0}
        <div class="mt-6">
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Deleted Contacts
            <span class="text-xs text-neutral-400 dark:text-neutral-500 font-normal ml-1">— soft-deleted, not visible to employees</span>
          </h2>
          <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
            {#each deletedContacts as contact (contact.id)}
              <div class="flex items-center gap-4 px-4 py-3">
                <Avatar name={contact.name || contact.org || '?'} size="sm" />
                <div class="flex-1 min-w-0">
                  <a href="/contacts/{contact.id}" class="text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-accent dark:hover:text-accent-dark transition-colors truncate block">
                    {contact.name || '—'}
                  </a>
                  {#if contact.org}
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{contact.org}</p>
                  {/if}
                </div>
                <div class="text-right shrink-0 min-w-0">
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    by <span class="font-medium">{contact.expand?.deleted_by?.name || contact.expand?.deleted_by?.email || 'Unknown'}</span>
                  </p>
                  <p class="text-[11px] text-neutral-400 dark:text-neutral-500">{formatDate(contact.deleted_at ?? '')}</p>
                </div>
                <button
                  on:click={() => restoreContact(contact.id)}
                  class="btn-secondary text-xs py-1.5 shrink-0"
                >
                  Restore
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
{/if}
