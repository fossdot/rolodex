<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { pb, photoUrl } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { Contact, Activity, Reaction, User, ContactLog, Reminder } from '$lib/types';
  import { FU_ROLES, TOPICS, ACTIVITY_TYPES } from '$lib/constants';
  import { istToUtc, utcToIstParts, DEFAULT_REMINDER_TIME } from '$lib/reminder';
  import Avatar from '$lib/components/Avatar.svelte';
  import ReminderFields from '$lib/components/ReminderFields.svelte';
  import Lightbox from '$lib/components/Lightbox.svelte';
  import Reactions from '$lib/components/Reactions.svelte';
  import RichText from '$lib/components/RichText.svelte';
  import ActivityForm from '$lib/components/ActivityForm.svelte';

  let contact: Contact | null = null;
  let activities: Activity[] = [];
  let loading = true;
  let showActivityForm = false;
  let actSaving = false;

  // Inline activity edit — the id of the activity currently open for editing.
  let editingActivityId: string | null = null;
  let editSaving = false;

  $: id = $page.params.id ?? '';

  let reactionsByActivity: Record<string, Reaction[]> = {};
  let logs: ContactLog[] = [];

  // ── Reminders — follow-ups attached to an activity ─────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  let users: User[] = [];
  let remindersByActivity: Record<string, Reminder[]> = {};

  // Inline per-activity reminder editor
  let editingReminderFor: string | null = null; // activity id being edited
  let remEditingId: string | null = null;        // existing reminder id, or null = new
  let remDate = '';
  let remTime = DEFAULT_REMINDER_TIME;
  let remTo = '';
  let remSaving = false;

  // Log-activity form: optional follow-up reminder
  let actRemind = false;
  let actRemindDate = '';
  let actRemindTime = DEFAULT_REMINDER_TIME;
  let actRemindTo = '';

  // The notify roster is only needed when a reminder form opens — fetch on demand.
  async function ensureUsers() {
    if (users.length) return;
    try {
      users = await pb.collection('users').getFullList<User>({ sort: 'name' });
    } catch {
      /* non-fatal — picker just shows nothing */
    }
  }

  // Only the current user's reminders come back (access rules scope them), so
  // every chip we render is personal.
  async function loadReminders() {
    try {
      const all = await pb.collection('reminders').getFullList<Reminder>({
        filter: `contact = '${id}'`,
        sort: 'remind_at',
        expand: 'notify',
      });
      const map: Record<string, Reminder[]> = {};
      for (const r of all) (map[r.activity] ??= []).push(r);
      remindersByActivity = map;
    } catch {
      remindersByActivity = {};
    }
  }

  async function openReminderEditor(activityId: string, existing?: Reminder) {
    await ensureUsers();
    remEditingId = existing?.id ?? null;
    const parts = utcToIstParts(existing?.remind_at);
    remDate = parts.date || todayStr;
    remTime = parts.time;
    remTo = existing?.notify || $currentUser?.id || '';
    editingReminderFor = activityId;
  }

  async function saveActivityReminder() {
    if (!editingReminderFor || !remDate) return;
    remSaving = true;
    try {
      const payload = {
        contact: id,
        activity: editingReminderFor,
        remind_at: istToUtc(remDate, remTime),
        notify: remTo || $currentUser?.id,
        created_by: $currentUser?.id, // also forced server-side
      };
      if (remEditingId) await pb.collection('reminders').update(remEditingId, payload);
      else await pb.collection('reminders').create(payload);
      await loadReminders();
      editingReminderFor = null;
      toasts.success('Reminder saved');
    } catch {
      toasts.error('Failed to save reminder');
    } finally {
      remSaving = false;
    }
  }

  async function deleteReminder(rem: Reminder) {
    try {
      await pb.collection('reminders').delete(rem.id);
      await loadReminders();
      toasts.success('Reminder removed');
    } catch {
      toasts.error('Failed to remove reminder');
    }
  }

  // Optional follow-up reminder shown inside the Log Activity form.
  async function toggleActReminder() {
    actRemind = !actRemind;
    if (actRemind) {
      await ensureUsers();
      if (!actRemindDate) actRemindDate = todayStr;
      if (!actRemindTo) actRemindTo = $currentUser?.id || '';
    }
  }

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
      loadReminders();
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

  type ActivityDraft = {
    activity_type: string;
    event_name: string;
    event_link: string;
    date: string;
    notes: string;
  };

  // Opening the create form resets only the optional follow-up reminder — the
  // ActivityForm itself mounts fresh, so its fields always start blank.
  function openActivityForm() {
    actRemind = false;
    actRemindDate = '';
    actRemindTime = DEFAULT_REMINDER_TIME;
    actRemindTo = '';
    showActivityForm = true;
  }

  function closeActivityForm() {
    showActivityForm = false;
    actRemind = false;
  }

  async function createActivity(e: CustomEvent<ActivityDraft>) {
    const d = e.detail;
    actSaving = true;
    try {
      const newAct = await pb.collection('activities').create({
        contact: id,
        activity_type: d.activity_type,
        event_name: d.event_name,
        event_link: d.event_link,
        date: d.date,
        notes: d.notes,
        logged_by: $currentUser?.id,
      });
      const expanded = await pb.collection('activities').getOne<Activity>(newAct.id, { expand: 'logged_by' });
      activities = [expanded, ...activities];

      // Optional follow-up reminder, born with the activity.
      if (actRemind && actRemindDate) {
        try {
          await pb.collection('reminders').create({
            contact: id,
            activity: newAct.id,
            remind_at: istToUtc(actRemindDate, actRemindTime),
            notify: actRemindTo || $currentUser?.id,
            created_by: $currentUser?.id,
          });
          await loadReminders();
        } catch {
          toasts.error('Activity saved, but the reminder could not be set');
        }
      }

      closeActivityForm();
      toasts.success('Activity logged');
    } catch {
      toasts.error('Failed to log activity');
    } finally {
      actSaving = false;
    }
  }

  async function updateActivity(activityId: string, d: ActivityDraft) {
    editSaving = true;
    try {
      // contact / logged_by / deleted_* are intentionally omitted — they are
      // immutable and re-pinned server-side on update.
      await pb.collection('activities').update(activityId, {
        activity_type: d.activity_type,
        event_name: d.event_name,
        event_link: d.event_link,
        date: d.date,
        notes: d.notes,
      });
      const expanded = await pb.collection('activities').getOne<Activity>(activityId, { expand: 'logged_by,deleted_by' });
      activities = activities.map((a) => (a.id === activityId ? expanded : a));
      editingActivityId = null;
      toasts.success('Activity updated');
    } catch {
      toasts.error('Failed to update activity');
    } finally {
      editSaving = false;
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

  // Fixing a logged activity is limited to whoever logged it, or an admin —
  // mirrors the server updateRule so the UI never offers an edit the API rejects.
  function canEditActivity(a: Activity) {
    return !a.deleted_at && !!$currentUser && ($currentUser.id === a.logged_by || $currentUser.role === 'admin');
  }

  // PocketBase stamps created == updated on insert, so a meaningfully-later
  // `updated` marks an activity that was edited after it was first logged.
  // PB returns space-separated datetimes (`2026-07-01 10:00:00Z`); normalise to
  // ISO so Safari/Firefox parse them too (else the marker would never show).
  function wasEdited(a: Activity) {
    const ms = (s: string) => new Date(String(s ?? '').replace(' ', 'T')).getTime();
    const c = ms(a.created);
    const u = ms(a.updated);
    return Number.isFinite(c) && Number.isFinite(u) && u - c > 2000;
  }

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
            <button on:click={() => (showActivityForm ? closeActivityForm() : openActivityForm())} class="btn-primary text-xs py-1.5 px-3">
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
          <ActivityForm
            idPrefix="act"
            heading="Log new activity"
            submitLabel="Save Activity"
            saving={actSaving}
            extraClass="mb-4"
            on:save={createActivity}
            on:cancel={closeActivityForm}
          >
            <!-- Optional follow-up reminder, linked to this activity -->
            <div class="border-t border-neutral-100 dark:border-neutral-800 pt-3">
              {#if !actRemind}
                <button type="button" on:click={toggleActReminder} class="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-accent dark:hover:text-accent-dark transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                  Add a follow-up reminder
                </button>
              {:else}
                <div class="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-3 space-y-3 animate-fade-in">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                      Follow-up reminder
                    </p>
                    <button type="button" on:click={() => (actRemind = false)} class="btn-ghost p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" title="Remove reminder">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <p class="text-[11px] text-neutral-500 dark:text-neutral-400 -mt-1.5">You'll be emailed at the chosen IST time; this activity's context is included. Defaults to 10 AM.</p>
                  <ReminderFields bind:date={actRemindDate} bind:time={actRemindTime} bind:notify={actRemindTo} {users} currentUserId={$currentUser?.id ?? ''} minDate={todayStr} idPrefix="act-rem" />
                </div>
              {/if}
            </div>
          </ActivityForm>
        {/if}

        <!-- Timeline -->
        {#if activities.length === 0}
          <div class="card p-8 flex flex-col items-center justify-center text-center">
            <svg class="text-neutral-300 dark:text-neutral-600 mb-3" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">No activities logged yet</p>
            {#if canLogActivity}
              <button on:click={openActivityForm} class="btn-ghost text-xs mt-3">Log first activity</button>
            {/if}
          </div>
        {:else}
          <div class="space-y-2">
            {#each shownActivities as activity (activity.id)}
              {@const rems = remindersByActivity[activity.id] ?? []}
              {@const pendingRem = rems.find((r) => !r.sent_at)}
              {@const sentRems = rems.filter((r) => r.sent_at)}
              {#if editingActivityId === activity.id}
                <ActivityForm
                  idPrefix={`act-edit-${activity.id}`}
                  heading="Edit activity"
                  submitLabel="Save Changes"
                  saving={editSaving}
                  initial={activity}
                  on:save={(e) => updateActivity(activity.id, e.detail)}
                  on:cancel={() => (editingActivityId = null)}
                />
              {:else}
              <div class="card px-4 py-3.5 flex items-start gap-3 group animate-fade-in {activity.deleted_at ? 'opacity-50' : ''}">
                <div class="w-1.5 h-1.5 rounded-full {activity.deleted_at ? 'bg-red-400' : 'bg-accent dark:bg-accent-dark'} mt-2 shrink-0"></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 {activity.deleted_at ? 'line-through' : ''}">
                      {getActivityLabel(activity.activity_type)}
                    </p>
                    <div class="flex items-center gap-1 shrink-0">
                      {#if canEditActivity(activity)}
                        <button on:click={() => (editingActivityId = activity.id)} class="btn-ghost p-1 text-neutral-400 hover:text-accent dark:hover:text-accent-dark" title="Edit activity" aria-label="Edit activity">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                      {/if}
                      <span class="text-xs text-neutral-400 dark:text-neutral-500">{formatDate(activity.date)}</span>
                    </div>
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
                    {:else if wasEdited(activity)}
                      · edited {formatDate(activity.updated)}
                    {/if}
                  </p>
                  {#if !activity.deleted_at}
                    <div class="mt-2">
                      <Reactions activityId={activity.id} reactions={reactionsByActivity[activity.id] ?? []} />
                    </div>

                    <!-- Reminder history (fired) -->
                    {#each sentRems as sr (sr.id)}
                      <p class="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1.5 flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        Reminded {formatIST(sr.remind_at)} IST
                      </p>
                    {/each}

                    <!-- Reminder: inline editor / pending chip / add affordance (personal) -->
                    {#if editingReminderFor === activity.id}
                      <div class="mt-2 rounded-lg border border-accent/40 dark:border-accent-dark/40 p-3 space-y-3 animate-fade-in">
                        <p class="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                          {remEditingId ? 'Edit reminder' : 'Follow-up reminder'}
                        </p>
                        <p class="text-[11px] text-neutral-500 dark:text-neutral-400 -mt-1.5">Linked to this activity — its context is included in the email. Defaults to 10 AM IST.</p>
                        <ReminderFields bind:date={remDate} bind:time={remTime} bind:notify={remTo} {users} currentUserId={$currentUser?.id ?? ''} minDate={todayStr} idPrefix={`rem-${activity.id}`} />
                        <div class="flex items-center gap-2 pt-0.5">
                          <button on:click={saveActivityReminder} disabled={remSaving || !remDate} class="btn-primary text-xs py-1.5">Save</button>
                          <button on:click={() => (editingReminderFor = null)} class="btn-secondary text-xs py-1.5">Cancel</button>
                        </div>
                      </div>
                    {:else if pendingRem}
                      <div class="mt-2 flex items-center flex-wrap gap-x-2 gap-y-1">
                        <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium bg-accent/10 dark:bg-accent-dark/15 text-accent dark:text-accent-dark">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                          Follow up {formatIST(pendingRem.remind_at)} IST
                        </span>
                        {#if pendingRem.notify !== $currentUser?.id}
                          <span class="text-[11px] text-neutral-400 dark:text-neutral-500">notifies {pendingRem.expand?.notify?.name || pendingRem.expand?.notify?.email}</span>
                        {/if}
                        {#if pendingRem.created_by === $currentUser?.id && canLogActivity}
                          <button on:click={() => openReminderEditor(activity.id, pendingRem)} class="btn-ghost p-1 text-neutral-400 hover:text-accent dark:hover:text-accent-dark" title="Edit reminder">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                          </button>
                          <button on:click={() => deleteReminder(pendingRem)} class="btn-ghost p-1 text-neutral-400 hover:text-red-500" title="Remove reminder">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        {/if}
                      </div>
                    {:else if canLogActivity}
                      <button on:click={() => openReminderEditor(activity.id)} class="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-accent dark:hover:text-accent-dark transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                        Add follow-up reminder
                      </button>
                    {/if}
                  {/if}
                </div>
              </div>
              {/if}
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
