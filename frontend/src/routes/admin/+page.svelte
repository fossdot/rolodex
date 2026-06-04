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

  let dateRange: 'week' | 'month' | 'year' | 'all' = 'month';

  const DATE_RANGES: ['week' | 'month' | 'year' | 'all', string][] = [
    ['week', 'This week'],
    ['month', 'This month'],
    ['year', 'This year'],
    ['all', 'All time'],
  ];

  function getDateFilter(range: typeof dateRange) {
    const now = new Date();
    if (range === 'all') return '';
    const d = new Date();
    if (range === 'week') d.setDate(now.getDate() - 7);
    else if (range === 'month') d.setMonth(now.getMonth() - 1);
    else if (range === 'year') d.setFullYear(now.getFullYear() - 1);
    return `created >= '${d.toISOString()}'`;
  }

  async function load() {
    if ($currentUser?.role !== 'admin') {
      goto('/contacts');
      return;
    }
    loading = true;
    try {
      const dateFilter = getDateFilter(dateRange);

      const activeFilter = dateFilter ? `deleted_at = null && ${dateFilter}` : 'deleted_at = null';

      const [contactsRes, activitiesRes, usersRes, recentRes, deletedRes] = await Promise.all([
        pb.collection('contacts').getList(1, 1, { filter: activeFilter }),
        pb.collection('activities').getList(1, 1, { filter: activeFilter }),
        pb.collection('users').getList<User>(1, 200),
        pb.collection('activities').getList<Activity>(1, 15, {
          sort: '-created',
          expand: 'logged_by,contact',
          filter: activeFilter,
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

      // Build leaderboard
      const users = usersRes.items;
      const board = await Promise.all(
        users.map(async (u) => {
          const userDateFilter = dateFilter ? `added_by = '${u.id}' && deleted_at = null && ${dateFilter}` : `added_by = '${u.id}' && deleted_at = null`;
          const actDateFilter = dateFilter ? `logged_by = '${u.id}' && deleted_at = null && ${dateFilter}` : `logged_by = '${u.id}' && deleted_at = null`;
          const [c, a] = await Promise.all([
            pb.collection('contacts').getList(1, 1, { filter: userDateFilter }),
            pb.collection('activities').getList(1, 1, { filter: actDateFilter }),
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
  $: dateRange, load();

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
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">Dashboard</h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Network engagement overview</p>
      </div>
      <!-- Date range filter -->
      <div class="flex border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden text-sm">
        {#each DATE_RANGES as [v, label]}
          <button
            on:click={() => (dateRange = v)}
            class="px-3 py-2 transition-colors {dateRange === v
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium'
              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
          >
            {label}
          </button>
        {/each}
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
