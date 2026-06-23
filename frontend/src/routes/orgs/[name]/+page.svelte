<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { pb, photoUrl } from '$lib/pb';
  import { toasts } from '$lib/stores';
  import type { Contact, Activity, User } from '$lib/types';
  import { ACTIVITY_TYPES } from '$lib/constants';
  import Avatar from '$lib/components/Avatar.svelte';

  $: orgName = decodeURIComponent($page.params.name ?? '');

  let contacts: Contact[] = [];
  let activities: Activity[] = [];
  let loading = true;
  let loadedFor = ''; // guards the reactive reload on client-side navigation

  async function load() {
    loading = true;
    try {
      const escaped = orgName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const cRes = await pb.collection('contacts').getList<Contact>(1, 200, {
        // case-insensitive exact match: ~ without wildcards still uses LIKE,
        // so escape % and _ to avoid partial matches
        filter: `org = '${escaped}' && deleted_at = null`,
        sort: 'name',
        expand: 'added_by',
      });
      contacts = cRes.items;

      if (contacts.length) {
        const orFilter = contacts.map((c) => `contact = '${c.id}'`).join(' || ');
        const aRes = await pb.collection('activities').getList<Activity>(1, 200, {
          filter: `(${orFilter}) && deleted_at = null`,
          sort: '-date,-created',
          expand: 'logged_by,contact',
        });
        activities = aRes.items;
      } else {
        activities = [];
      }
    } catch {
      toasts.error('Failed to load organisation');
    } finally {
      loading = false;
    }
  }

  // load on mount and reload when navigating between org pages;
  // loadedFor is set before load() so this can't retrigger itself
  $: if (typeof window !== 'undefined' && orgName && orgName !== loadedFor) {
    loadedFor = orgName;
    load();
  }

  function getActivityLabel(v: string) {
    return ACTIVITY_TYPES.find((a) => a.value === v)?.label ?? v;
  }

  function formatDate(d: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Employees who engage with this org (logged activities on its contacts)
  $: engaged = [
    ...new Map(
      activities
        .filter((a) => a.expand?.logged_by)
        .map((a) => [a.logged_by, a.expand!.logged_by as User])
    ).values(),
  ];
</script>

<svelte:head>
  <title>{orgName || 'Organisation'} · Rolodex</title>
</svelte:head>

<div class="px-6 py-6 max-w-6xl mx-auto">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-6">
    <a href="{base}/orgs" class="btn-ghost p-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    </a>
    <div>
      <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">{orgName}</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
        {loading ? '—' : `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'} · ${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}`}
      </p>
    </div>
  </div>

  {#if loading}
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-pulse">
      <div class="lg:col-span-2 space-y-2">
        {#each Array(3) as _}
          <div class="card p-4 h-16 bg-neutral-50 dark:bg-neutral-900"></div>
        {/each}
      </div>
      <div class="lg:col-span-3 space-y-2">
        {#each Array(5) as _}
          <div class="card p-4 h-14 bg-neutral-50 dark:bg-neutral-900"></div>
        {/each}
      </div>
    </div>
  {:else if contacts.length === 0}
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">No contacts at this organisation</p>
      <p class="text-sm text-neutral-400 dark:text-neutral-500 mt-1">It may have been renamed or its contacts removed</p>
      <a href="{base}/orgs" class="btn-secondary mt-4">All organisations</a>
    </div>
  {:else}
    <!-- Engaged employees -->
    {#if engaged.length > 0}
      <div class="card p-4 mb-6 flex flex-wrap items-center gap-3">
        <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Engaged by</span>
        {#each engaged as emp (emp.id)}
          <span class="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
            <Avatar name={emp.name || emp.email || '?'} size="sm" />
            {emp.name || emp.email}
          </span>
        {/each}
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- People -->
      <div class="lg:col-span-2">
        <h2 class="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 py-1.5">
          People <span class="font-normal">· {contacts.length}</span>
        </h2>
        <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
          {#each contacts as contact (contact.id)}
            <a href="{base}/contacts/{contact.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors group">
              <Avatar name={contact.name || contact.org || '?'} size="sm" src={photoUrl(contact, '100x100')} />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate group-hover:text-accent dark:group-hover:text-accent-dark transition-colors">
                  {contact.name || '—'}
                </p>
                <p class="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                  {[contact.designation, contact.city].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <span class="text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0">
                via {contact.expand?.added_by?.name || contact.expand?.added_by?.email || '?'}
              </span>
            </a>
          {/each}
        </div>
      </div>

      <!-- Combined activity timeline -->
      <div class="lg:col-span-3">
        <h2 class="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2 py-1.5">
          Activity <span class="font-normal">· {activities.length}</span>
        </h2>
        {#if activities.length === 0}
          <div class="card px-4 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
            No activities logged with this organisation yet
          </div>
        {:else}
          <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
            {#each activities as act (act.id)}
              <div class="flex items-start gap-3 px-4 py-3.5">
                <div class="w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent-dark mt-2 shrink-0"></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {getActivityLabel(act.activity_type)}
                      {#if act.expand?.contact}
                        <span class="text-neutral-400 dark:text-neutral-500 font-normal">·</span>
                        <a href="{base}/contacts/{act.contact}" class="text-accent dark:text-accent-dark font-normal hover:underline">
                          {act.expand.contact.name || act.expand.contact.org || 'Unknown'}
                        </a>
                      {/if}
                    </p>
                    <span class="text-xs text-neutral-400 dark:text-neutral-500 shrink-0">{formatDate(act.date)}</span>
                  </div>
                  {#if act.event_name}
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{act.event_name}</p>
                  {/if}
                  <p class="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
                    by {act.expand?.logged_by?.name || act.expand?.logged_by?.email || 'Unknown'}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
