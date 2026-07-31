<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { pb, photoUrl } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { Contact, Activity, Organisation, User } from '$lib/types';
  import { ACTIVITY_TYPES } from '$lib/constants';
  import Avatar from '$lib/components/Avatar.svelte';
  import { contactLabel, loadOrganisations } from '$lib/org';
  import { participantLine } from '$lib/activity';

  $: orgName = decodeURIComponent($page.params.name ?? '');

  let contacts: Contact[] = [];
  let activities: Activity[] = [];
  let loading = true;
  let loadedFor = ''; // guards the reactive reload on client-side navigation

  // ── Renaming (admins only) ─────────────────────────────────────────────────
  // Organisations are shared records, so renaming one relabels it for every
  // contact linked to it — which is also how two near-duplicates get merged:
  // rename one to exactly match the other and the unique index folds them.
  let org: Organisation | null = null;
  let renaming = false;
  let draftName = '';
  let renameError = '';
  let renameSaving = false;
  $: canRename = $currentUser?.role === 'admin';

  function startRename() {
    draftName = org?.name ?? orgName;
    renameError = '';
    renaming = true;
  }

  // ── Merging (admins only) ──────────────────────────────────────────────────
  // Renaming cannot merge: names are uniquely indexed, so renaming onto an
  // existing one is rejected. Merging instead re-points every contact — live and
  // soft-deleted — at the target organisation, carries over any per-org
  // designation the target does not already have, then deletes this one.
  let merging = false;
  let mergeTarget = '';
  let mergeError = '';
  let mergeSaving = false;
  let mergeOptions: Organisation[] = [];

  async function startMerge() {
    mergeError = '';
    mergeTarget = '';
    try {
      const all = await loadOrganisations();
      mergeOptions = all.filter((o) => o.id !== org?.id);
      merging = true;
    } catch {
      toasts.error('Could not load the organisation list');
    }
  }

  async function doMerge() {
    if (!org || !mergeTarget) return;
    const target = mergeOptions.find((o) => o.id === mergeTarget);
    if (!target) return;
    if (!confirm(
      `Merge “${org.name}” into “${target.name}”?\n\n` +
      `Every contact filed under “${org.name}” moves to “${target.name}”, and “${org.name}” is removed. This cannot be undone from the app.`
    )) return;

    mergeSaving = true;
    mergeError = '';
    try {
      // Soft-deleted contacts link to organisations too, so they must move as
      // well or they would be left pointing at a deleted record.
      const affected = await pb.collection('contacts').getFullList<Contact>({
        filter: `orgs.id ?= '${org.id}'`,
        batch: 200,
      });

      for (const c of affected) {
        // Preserve order, swap this org for the target, drop a duplicate if the
        // contact was already filed under both.
        const next: string[] = [];
        for (const id of c.orgs ?? []) {
          const mapped = id === org.id ? target.id : id;
          if (!next.includes(mapped)) next.push(mapped);
        }
        const designations = { ...(c.org_designations ?? {}) };
        const carried = designations[org.id];
        delete designations[org.id];
        // Only fill the target's designation if it has none of its own.
        if (carried && !designations[target.id]) designations[target.id] = carried;

        await pb.collection('contacts').update(c.id, { orgs: next, org_designations: designations });
      }

      await pb.collection('organisations').delete(org.id);
      toasts.success(`Merged into “${target.name}” — ${affected.length} ${affected.length === 1 ? 'contact' : 'contacts'} moved`);
      await goto(`${base}/orgs/${encodeURIComponent(target.name)}`, { replaceState: true });
    } catch (e: unknown) {
      const msg = (e as { response?: { message?: string } })?.response?.message;
      mergeError = msg || 'Could not merge these organisations.';
    } finally {
      mergeSaving = false;
    }
  }

  async function saveRename() {
    const next = draftName.trim();
    if (!org || !next || next === org.name) { renaming = false; return; }
    renameSaving = true;
    renameError = '';
    try {
      await pb.collection('organisations').update(org.id, { name: next });
      toasts.success(`Renamed to “${next}” for all ${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}`);
      renaming = false;
      // The route is keyed by name, so move to the new URL.
      await goto(`${base}/orgs/${encodeURIComponent(next)}`, { replaceState: true });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: Record<string, { message?: string }>; message?: string } })?.response;
      // The collection has a case-insensitive unique index on `name`.
      renameError = msg?.data?.name?.message
        ? `“${next}” already exists — names must be unique. If they are the same organisation, use Merge below instead.`
        : (msg?.message || 'Could not rename this organisation.');
    } finally {
      renameSaving = false;
    }
  }

  async function load() {
    loading = true;
    try {
      const escaped = orgName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const cRes = await pb.collection('contacts').getList<Contact>(1, 200, {
        // `orgs` is a multi-relation, so `?=` means "any of this contact's
        // organisations is exactly this one" — an exact match, unlike `~`, so
        // "Foundation" can't pull in "Foundation for Free Software".
        filter: `orgs.name ?= '${escaped}' && deleted_at = null`,
        sort: 'name',
        expand: 'added_by,orgs',
      });
      contacts = cRes.items;
      // The record itself, so a rename has an id to write to.
      org = (cRes.items[0]?.expand?.orgs ?? []).find((o) => o.name === orgName) ?? null;
      if (!org) {
        const oRes = await pb.collection('organisations').getList<Organisation>(1, 1, {
          filter: `name = '${escaped}'`,
        });
        org = oRes.items[0] ?? null;
      }

      if (contacts.length) {
        // `contacts.id ?=` tests membership of the multi-relation (issue #6);
        // a bare `contacts ?= '<id>'` matches nothing.
        const orFilter = contacts.map((c) => `contacts.id ?= '${c.id}'`).join(' || ');
        const aRes = await pb.collection('activities').getList<Activity>(1, 200, {
          filter: `(${orFilter}) && deleted_at = null`,
          sort: '-date,-created',
          expand: 'logged_by,contacts',
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
    <div class="min-w-0 flex-1">
      {#if renaming}
        <!-- Renaming relabels this organisation for every linked contact. -->
        <div class="flex flex-wrap items-center gap-2">
          <input
            type="text"
            bind:value={draftName}
            on:keydown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') renaming = false; }}
            aria-label="Organisation name"
            maxlength="200"
            class="input w-auto min-w-64 text-lg font-semibold {renameError ? 'ring-2 ring-red-400' : ''}"
          />
          <button on:click={saveRename} disabled={renameSaving || !draftName.trim()} class="btn-primary text-sm py-1.5">
            {renameSaving ? 'Saving…' : 'Save'}
          </button>
          <button on:click={() => (renaming = false)} class="btn-secondary text-sm py-1.5">Cancel</button>
        </div>
        {#if renameError}
          <p class="text-xs text-red-500 mt-1.5 max-w-xl">{renameError}</p>
        {:else}
          <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">
            Applies to all {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} here.
          </p>
        {/if}
      {:else}
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight truncate">{orgName}</h1>
          {#if canRename && org}
            <button
              on:click={startRename}
              class="btn-ghost p-1.5 text-neutral-400 hover:text-accent dark:hover:text-accent-dark shrink-0"
              title="Rename organisation"
              aria-label="Rename organisation"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
          {/if}
        </div>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          {loading ? '—' : `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'} · ${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}`}
        </p>
      {/if}

      <!-- Merging is separate from renaming because names are uniquely indexed:
           renaming onto an existing organisation is rejected, not combined. -->
      {#if canRename && org && !renaming}
        {#if !merging}
          <button
            on:click={startMerge}
            class="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-accent dark:hover:text-accent-dark transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v6a4 4 0 0 0 4 4h9"/><path d="m16 9 4 4-4 4"/></svg>
            Merge into another organisation
          </button>
        {:else}
          <div class="mt-2 rounded-lg border border-accent/40 dark:border-accent-dark/40 p-3 space-y-2 max-w-xl animate-fade-in">
            <p class="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Move everyone here into another organisation
            </p>
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
              All {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} filed under “{orgName}” move across, and “{orgName}” is removed. Use this for duplicates like <em>Acme</em> and <em>Acme, Inc</em>.
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <select bind:value={mergeTarget} class="input w-auto min-w-56 text-sm">
                <option value="">Choose an organisation…</option>
                {#each mergeOptions as o (o.id)}
                  <option value={o.id}>{o.name}</option>
                {/each}
              </select>
              <button on:click={doMerge} disabled={mergeSaving || !mergeTarget} class="btn-primary text-sm py-1.5">
                {mergeSaving ? 'Merging…' : 'Merge'}
              </button>
              <button on:click={() => (merging = false)} class="btn-secondary text-sm py-1.5">Cancel</button>
            </div>
            {#if mergeError}<p class="text-xs text-red-500">{mergeError}</p>{/if}
          </div>
        {/if}
      {/if}
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
              <Avatar name={contactLabel(contact)} size="sm" src={photoUrl(contact, '100x100')} />
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
                      {#if act.expand?.contacts?.length}
                        <span class="text-neutral-400 dark:text-neutral-500 font-normal">·</span>
                        <a href="{base}/contacts/{act.contact}" class="text-accent dark:text-accent-dark font-normal hover:underline">
                          {participantLine(act)}
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
