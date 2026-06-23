<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { pb, photoUrl } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { Contact, Activity, Reaction, User, ContactLog } from '$lib/types';
  import { FU_ROLES, TOPICS, ACTIVITY_TYPES } from '$lib/constants';
  import Avatar from '$lib/components/Avatar.svelte';
  import Lightbox from '$lib/components/Lightbox.svelte';
  import Reactions from '$lib/components/Reactions.svelte';
  import RichText from '$lib/components/RichText.svelte';
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  import { sanitizeHtml, htmlToText } from '$lib/sanitizeHtml';

  let contact: Contact | null = null;
  let activities: Activity[] = [];
  let loading = true;
  let showActivityForm = false;

  // Activity form state
  let actType = '';
  let actEvent = '';
  let actLink = '';
  let actDate = new Date().toISOString().split('T')[0];
  let actNotes = '';
  let actSaving = false;
  let actErrors: Record<string, string> = {};

  $: id = $page.params.id ?? '';

  let reactionsByActivity: Record<string, Reaction[]> = {};
  let logs: ContactLog[] = [];

  async function loadLogs() {
    try {
      const r = await pb.collection('contact_logs').getList<ContactLog>(1, 100, {
        filter: `contact = '${id}'`,
        sort: '-created',
        expand: 'editor',
      });
      logs = r.items;
    } catch {
      /* non-fatal — history just doesn't render */
    }
  }

  async function loadReactions(activityIds: string[]) {
    if (!activityIds.length) {
      reactionsByActivity = {};
      return;
    }
    try {
      const all = await pb.collection('reactions').getFullList<Reaction>({
        filter: activityIds.map((aid) => `activity = '${aid}'`).join(' || '),
        expand: 'user',
      });
      const map: Record<string, Reaction[]> = {};
      for (const r of all) (map[r.activity] ??= []).push(r);
      reactionsByActivity = map;
    } catch {
      /* non-fatal — reactions just don't render */
    }
  }

  async function load() {
    loading = true;
    try {
      [contact, activities] = await Promise.all([
        pb.collection('contacts').getOne<Contact>(id, { expand: 'added_by,deleted_by' }),
        pb.collection('activities').getList<Activity>(1, 100, {
          filter: `contact = '${id}'`,
          sort: '-date,-created',
          expand: 'logged_by,deleted_by',
        }).then((r) => r.items),
      ]);
      loadReactions(activities.map((a) => a.id));
      loadLogs();
    } catch {
      toasts.error('Contact not found');
      goto(`${base}/contacts`);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function getRoleLabel(v: string) { return FU_ROLES.find((r) => r.value === v)?.label ?? v; }
  function getTopicLabel(v: string) { return TOPICS.find((t) => t.value === v)?.label ?? v; }
  function getActivityLabel(v: string) { return ACTIVITY_TYPES.find((a) => a.value === v)?.label ?? v; }

  function displayName(c: Contact | null) {
    if (!c) return '';
    return c.name || c.org || 'Unknown';
  }

  async function saveActivity() {
    actErrors = {};
    if (!actType) actErrors.type = 'Select an activity type.';
    if (!actEvent.trim()) actErrors.event = 'Event / context is required.';
    if (!htmlToText(actNotes).trim()) actErrors.notes = 'Notes are required.';
    if (Object.keys(actErrors).length) return;

    actSaving = true;
    try {
      const newAct = await pb.collection('activities').create({
        contact: id,
        activity_type: actType,
        event_name: actEvent.trim(),
        event_link: actLink.trim(),
        date: actDate,
        notes: sanitizeHtml(actNotes),
        logged_by: $currentUser?.id,
      });
      const expanded = await pb.collection('activities').getOne<Activity>(newAct.id, { expand: 'logged_by' });
      activities = [expanded, ...activities];
      showActivityForm = false;
      actType = '';
      actEvent = '';
      actLink = '';
      actDate = new Date().toISOString().split('T')[0];
      actNotes = '';
      toasts.success('Activity logged');
    } catch {
      toasts.error('Failed to log activity');
    } finally {
      actSaving = false;
    }
  }

  async function deleteContact() {
    if (!confirm(`Mark "${displayName(contact)}" as deleted?`)) return;
    try {
      await pb.collection('contacts').update(id, {
        deleted_at: new Date().toISOString(),
        deleted_by: $currentUser?.id,
      });
      toasts.success('Contact deleted');
      goto(`${base}/contacts`);
    } catch {
      toasts.error('Failed to delete contact');
    }
  }

  async function restoreContact() {
    try {
      await pb.collection('contacts').update(id, { deleted_at: '', deleted_by: '' });
      contact = { ...contact!, deleted_at: '', deleted_by: '' };
      toasts.success('Contact restored');
    } catch {
      toasts.error('Failed to restore contact');
    }
  }

  // Editing is open to every signed-in employee; only the creator can delete.
  $: canEditContact = !!contact && ($currentUser?.role === 'admin' || !contact.deleted_at);
  $: canDeleteContact = !!contact && !contact.deleted_at && $currentUser?.id === contact.added_by;
  // Anyone signed in — employees and directors alike — can log activities
  // on any contact. Engagement is shared; logged_by is forced to self.
  $: canLogActivity = !!$currentUser && !contact?.deleted_at;

  // ── Photo lightbox ───────────────────────────────────────────────────────────
  // The full-size original is only assigned (and therefore fetched) on click.
  let lightboxOpen = false;
  let lightboxSrc = '';
  function openPhoto() {
    if (!contact?.photo) return;
    lightboxSrc = photoUrl(contact);
    lightboxOpen = true;
  }

  // ── Engaged employees ────────────────────────────────────────────────────────
  // Everyone who has logged a (non-deleted) activity on this contact.
  $: engaged = [
    ...new Map(
      activities
        .filter((a) => !a.deleted_at && a.expand?.logged_by)
        .map((a) => [a.logged_by, a.expand!.logged_by as User])
    ).values(),
  ];

  let employeeFilter = '';
  $: shownActivities = employeeFilter
    ? activities.filter((a) => a.logged_by === employeeFilter)
    : activities;

  function formatDate(d: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatIST(d: string) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  function editorName(log: ContactLog) {
    return log.expand?.editor?.name || log.expand?.editor?.email || 'Unknown';
  }
</script>

<svelte:head>
  <title>{displayName(contact) || 'Contact'} · Rolodex</title>
</svelte:head>

{#if loading}
  <div class="px-6 py-6 max-w-5xl mx-auto animate-pulse space-y-4">
    <div class="h-8 bg-neutral-100 dark:bg-neutral-800 rounded w-48"></div>
    <div class="grid grid-cols-3 gap-4">
      <div class="col-span-2 card p-5 space-y-3">
        <div class="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-3/4"></div>
        <div class="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2"></div>
      </div>
      <div class="card p-5">
        <div class="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-full"></div>
      </div>
    </div>
  </div>

{:else if contact}
  <div class="px-6 py-6 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6 flex-wrap">
      <a href="{base}/contacts" class="btn-ghost p-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </a>
      <div class="flex-1 flex items-center gap-4">
        {#if contact.photo}
          <button on:click={openPhoto} class="cursor-zoom-in rounded-full focus:outline-none focus:ring-2 focus:ring-accent" title="View photo">
            <Avatar name={displayName(contact)} size="lg" src={photoUrl(contact, '100x100')} />
          </button>
        {:else}
          <Avatar name={displayName(contact)} size="lg" />
        {/if}
        <div>
          <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">
            {contact.name || '—'}
          </h1>
          {#if contact.org}
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              {contact.designation ? `${contact.designation} · ` : ''}<a href="{base}/orgs/{encodeURIComponent(contact.org)}" class="hover:text-accent dark:hover:text-accent-dark hover:underline transition-colors">{contact.org}</a>
            </p>
          {:else if contact.designation}
            <p class="text-sm text-neutral-500 dark:text-neutral-400">{contact.designation}</p>
          {/if}
        </div>
      </div>
      {#if canEditContact || canDeleteContact}
        <div class="flex items-center gap-2">
          {#if canEditContact}
            <a href="{base}/contacts/{id}/edit" class="btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              Edit
            </a>
          {/if}
          {#if canDeleteContact}
            <button on:click={deleteContact} class="btn-ghost p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if contact.deleted_at}
      <div class="mb-5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <svg class="text-red-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          <p class="text-sm text-red-700 dark:text-red-300 truncate">
            Deleted by <span class="font-medium">{contact.expand?.deleted_by?.name || contact.expand?.deleted_by?.email || 'Unknown'}</span> on {formatDate(contact.deleted_at)}
          </p>
        </div>
        {#if $currentUser?.role === 'admin'}
          <button on:click={restoreContact} class="btn-secondary text-xs py-1.5 shrink-0">Restore</button>
        {/if}
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <!-- Left: contact details -->
      <div class="lg:col-span-2 min-w-0 space-y-4">
        <div class="card p-5 space-y-4">
          <h2 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Contact</h2>
          <div class="space-y-3">
            {#if contact.email}
              <div class="flex items-center gap-2.5">
                <svg class="text-neutral-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <a href="mailto:{contact.email}" class="text-sm text-neutral-900 dark:text-neutral-100 hover:text-accent dark:hover:text-accent-dark transition-colors truncate">{contact.email}</a>
              </div>
            {/if}
            {#if contact.secondary_email}
              <div class="flex items-center gap-2.5">
                <svg class="text-neutral-300 dark:text-neutral-600 shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <a href="mailto:{contact.secondary_email}" class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-accent dark:hover:text-accent-dark transition-colors truncate">{contact.secondary_email}</a>
              </div>
            {/if}
            {#if contact.mobile}
              <div class="flex items-center gap-2.5">
                <svg class="text-neutral-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>
                </svg>
                <a href="tel:{contact.mobile}" class="text-sm text-neutral-900 dark:text-neutral-100 hover:text-accent dark:hover:text-accent-dark transition-colors">{contact.mobile}</a>
              </div>
            {/if}
            {#if contact.secondary_mobile}
              <div class="flex items-center gap-2.5">
                <svg class="text-neutral-300 dark:text-neutral-600 shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>
                </svg>
                <span class="text-sm text-neutral-500 dark:text-neutral-400">{contact.secondary_mobile}</span>
              </div>
            {/if}
            {#if contact.city || contact.country}
              <div class="flex items-center gap-2.5">
                <svg class="text-neutral-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <span class="text-sm text-neutral-900 dark:text-neutral-100">{[contact.city, contact.country].filter(Boolean).join(', ')}</span>
              </div>
            {/if}
            {#if contact.linkedin}
              <div class="flex items-center gap-2.5">
                <svg class="text-neutral-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>
                </svg>
                <a
                  href={contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-neutral-900 dark:text-neutral-100 hover:text-accent dark:hover:text-accent-dark transition-colors truncate"
                >
                  {contact.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '') || contact.linkedin}
                </a>
              </div>
            {/if}
          </div>
        </div>

        {#if contact.how_you_know}
          <div class="card p-5">
            <h2 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">How you know them</h2>
            <RichText value={contact.how_you_know} extraClass="text-sm text-neutral-700 dark:text-neutral-300" />
          </div>
        {/if}

        {#if contact.fu_roles?.length}
          <div class="card p-5">
            <h2 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">FOSS United Roles</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each contact.fu_roles.filter(r => r !== 'other') as role}
                <span class="badge-green">{getRoleLabel(role)}</span>
              {/each}
              {#if contact.fu_roles.includes('other') && contact.fu_roles_other}
                <span class="badge-green">{contact.fu_roles_other}</span>
              {:else if contact.fu_roles.includes('other')}
                <span class="badge-neutral">Other</span>
              {/if}
            </div>
          </div>
        {/if}

        {#if contact.topics?.length}
          <div class="card p-5">
            <h2 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Topics</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each contact.topics.filter(t => t !== 'other') as topic}
                <span class="badge-neutral">{getTopicLabel(topic)}</span>
              {/each}
              {#if contact.topics.includes('other') && contact.topics_other}
                <span class="badge-neutral">{contact.topics_other}</span>
              {:else if contact.topics.includes('other')}
                <span class="badge-neutral">Other</span>
              {/if}
            </div>
          </div>
        {/if}

        <div class="card p-5">
          <h2 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Meta</h2>
          <div class="space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <p>Added by <span class="text-neutral-700 dark:text-neutral-300 font-medium">{contact.expand?.added_by?.name || contact.expand?.added_by?.email || 'Unknown'}</span></p>
            <p>Created {formatDate(contact.created)}</p>
            <p>Updated {formatDate(contact.updated)}</p>
          </div>
        </div>
      </div>

      <!-- Right: activities -->
      <div class="lg:col-span-3 min-w-0">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Activities
            {#if activities.length}
              <span class="text-neutral-400 dark:text-neutral-500 font-normal">({activities.length})</span>
            {/if}
          </h2>
          {#if canLogActivity}
            <button on:click={() => (showActivityForm = !showActivityForm)} class="btn-primary text-xs py-1.5 px-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5v14"/>
              </svg>
              Log Activity
            </button>
          {/if}
        </div>

        <!-- Engaged employees — everyone who has logged activities here -->
        {#if engaged.length > 0}
          <div class="flex flex-wrap items-center gap-1.5 mb-4">
            <button
              on:click={() => (employeeFilter = '')}
              class="px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                {employeeFilter === ''
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'}"
            >
              All
            </button>
            {#each engaged as emp (emp.id)}
              <button
                on:click={() => (employeeFilter = employeeFilter === emp.id ? '' : emp.id)}
                class="flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full text-xs font-medium border transition-all
                  {employeeFilter === emp.id
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'}"
                title="Show only {emp.name || emp.email}'s activities"
              >
                <Avatar name={emp.name || emp.email || '?'} size="sm" />
                {emp.name || emp.email}
              </button>
            {/each}
          </div>
        {/if}

        <!-- Activity form -->
        {#if showActivityForm}
          <div class="card p-5 mb-4 animate-fade-in space-y-4">
            <h3 class="text-sm font-medium text-neutral-900 dark:text-neutral-100">Log new activity</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="act-type" class="label">Activity Type *</label>
                <select id="act-type" bind:value={actType} class="input {actErrors.type ? 'ring-2 ring-red-400' : ''}">
                  <option value="">Select type…</option>
                  {#each ACTIVITY_TYPES as t}
                    <option value={t.value}>{t.label}</option>
                  {/each}
                </select>
                {#if actErrors.type}<p class="text-xs text-red-500 mt-1">{actErrors.type}</p>{/if}
              </div>
              <div>
                <label for="act-date" class="label">Date</label>
                <input id="act-date" type="date" bind:value={actDate} class="input" />
              </div>
              <div class="sm:col-span-2">
                <label for="act-event" class="label">Event / Context *</label>
                <input id="act-event" type="text" bind:value={actEvent} class="input {actErrors.event ? 'ring-2 ring-red-400' : ''}" placeholder="IndiaFOSS 2025, FOSS United Delhi Meetup…" />
                {#if actErrors.event}<p class="text-xs text-red-500 mt-1">{actErrors.event}</p>{/if}
              </div>
              <div class="sm:col-span-2">
                <label for="act-link" class="label">Event Link <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
                <input id="act-link" type="url" bind:value={actLink} class="input" placeholder="https://fossunited.org/events/…" />
              </div>
              <div class="sm:col-span-2">
                <label for="act-notes" class="label">Notes *</label>
                <RichTextEditor id="act-notes" bind:value={actNotes} invalid={!!actErrors.notes} placeholder="What happened, follow-ups, context…" />
                {#if actErrors.notes}<p class="text-xs text-red-500 mt-1">{actErrors.notes}</p>{/if}
              </div>
            </div>
            <div class="flex justify-end gap-2">
              <button on:click={() => (showActivityForm = false)} class="btn-secondary text-sm py-1.5">Cancel</button>
              <button on:click={saveActivity} disabled={actSaving} class="btn-primary text-sm py-1.5">
                {#if actSaving}
                  <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving…
                {:else}
                  Save Activity
                {/if}
              </button>
            </div>
          </div>
        {/if}

        <!-- Timeline -->
        {#if activities.length === 0}
          <div class="card p-8 flex flex-col items-center justify-center text-center">
            <svg class="text-neutral-300 dark:text-neutral-600 mb-3" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">No activities logged yet</p>
            {#if canLogActivity}
              <button on:click={() => (showActivityForm = true)} class="btn-ghost text-xs mt-3">Log first activity</button>
            {/if}
          </div>
        {:else}
          <div class="space-y-2">
            {#each shownActivities as activity (activity.id)}
              <div class="card px-4 py-3.5 flex items-start gap-3 group animate-fade-in {activity.deleted_at ? 'opacity-50' : ''}">
                <div class="w-1.5 h-1.5 rounded-full {activity.deleted_at ? 'bg-red-400' : 'bg-accent dark:bg-accent-dark'} mt-2 shrink-0"></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 {activity.deleted_at ? 'line-through' : ''}">
                      {getActivityLabel(activity.activity_type)}
                    </p>
                    <span class="text-xs text-neutral-400 dark:text-neutral-500 shrink-0">{formatDate(activity.date)}</span>
                  </div>
                  {#if activity.event_name}
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {activity.event_name}
                      {#if activity.event_link}
                        · <a href={activity.event_link} target="_blank" rel="noopener noreferrer" class="text-accent dark:text-accent-dark hover:underline">event link ↗</a>
                      {/if}
                    </p>
                  {/if}
                  {#if activity.notes}
                    <RichText value={activity.notes} extraClass="text-xs text-neutral-600 dark:text-neutral-400 mt-1" />
                  {/if}
                  <p class="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                    by {activity.expand?.logged_by?.name || activity.expand?.logged_by?.email || 'Unknown'}
                    {#if activity.deleted_at}
                      · <span class="text-red-400">deleted {formatDate(activity.deleted_at)}</span>
                    {/if}
                  </p>
                  {#if !activity.deleted_at}
                    <div class="mt-2">
                      <Reactions activityId={activity.id} reactions={reactionsByActivity[activity.id] ?? []} />
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if logs.length}
      <div class="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
        <h2 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">Edit History</h2>
        <div>
          {#each logs as log (log.id)}
            <div class="flex flex-col sm:flex-row sm:gap-6 py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
              <p class="text-xs text-neutral-500 dark:text-neutral-400 sm:w-56 shrink-0 mb-1 sm:mb-0">
                <span class="font-medium text-neutral-700 dark:text-neutral-300">{editorName(log)}</span>
                <span class="block sm:mt-0.5">{formatIST(log.created)}</span>
              </p>
              <ul class="flex-1 min-w-0 text-xs space-y-1">
                {#each log.changes ?? [] as ch}
                  <li class="leading-relaxed break-words">
                    <span class="font-medium text-neutral-600 dark:text-neutral-300">{ch.field}:</span>
                    <span class="text-neutral-400 dark:text-neutral-500 line-through">{ch.from}</span>
                    <span class="text-neutral-400 dark:text-neutral-500"> → </span>
                    <span class="text-neutral-700 dark:text-neutral-200">{ch.to}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <Lightbox bind:open={lightboxOpen} src={lightboxSrc} alt={displayName(contact)} />
{/if}
