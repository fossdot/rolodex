<script lang="ts">
  // Standalone activity logging (issue #6). Most activities involve more than one
  // person — a summit has a speaker, an organiser, a sponsor — so this logs the
  // event once and attaches everyone who was there, rather than repeating the
  // same notes under each contact.
  //
  // The per-contact "Log Activity" button on a contact page still exists for the
  // one-person case; both write the same `activities` row shape.
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { Activity, Contact, User } from '$lib/types';
  import { istToUtc, DEFAULT_REMINDER_TIME } from '$lib/reminder';
  import { contactLabel } from '$lib/org';
  import ActivityForm from '$lib/components/ActivityForm.svelte';
  import ContactsPicker from '$lib/components/ContactsPicker.svelte';
  import ReminderFields from '$lib/components/ReminderFields.svelte';

  const todayStr = new Date().toISOString().split('T')[0];

  let people: Contact[] = [];
  // Each participant's part in this activity, keyed by contact id.
  let peopleRoles: Record<string, string> = {};
  let peopleError = '';
  let saving = false;

  // Optional follow-up reminder, mirroring the one on the contact page.
  let users: User[] = [];
  let remind = false;
  let remindDate = '';
  let remindTime = DEFAULT_REMINDER_TIME;
  let remindTo = '';
  let remindCc: string[] = [];
  let remindCcEmails = '';
  let remindInvalid = false;
  // Which of the picked contacts the follow-up is about — an activity can now
  // cover several people, so the reminder has to say who it concerns.
  let remindAbout = '';

  async function ensureUsers() {
    if (users.length) return;
    try {
      users = await pb.collection('users').getFullList<User>({ sort: 'name' });
    } catch {
      /* non-fatal — picker just shows nothing */
    }
  }

  async function toggleRemind() {
    remind = !remind;
    if (remind) {
      await ensureUsers();
      if (!remindDate) remindDate = todayStr;
      if (!remindTo) remindTo = $currentUser?.id ?? '';
    }
  }

  // Default the follow-up's subject to the first person added, and keep it valid
  // if that person is later removed.
  $: if (people.length && !people.some((p) => p.id === remindAbout)) remindAbout = people[0].id;
  $: if (!people.length) remindAbout = '';

  $: if (people.length) peopleError = '';

  type ActivityDraft = {
    activity_type: string;
    event_name: string;
    event_link: string;
    date: string;
    notes: string;
  };

  async function save(e: CustomEvent<ActivityDraft>) {
    if (!people.length) {
      peopleError = 'Add at least one contact who was involved.';
      return;
    }
    const d = e.detail;
    saving = true;
    try {
      const created = await pb.collection('activities').create<Activity>({
        contacts: people.map((p) => p.id),
        contact_roles: peopleRoles,
        activity_type: d.activity_type,
        event_name: d.event_name,
        event_link: d.event_link,
        date: d.date,
        notes: d.notes,
        logged_by: $currentUser?.id,
      });

      if (remind && remindDate && remindAbout) {
        try {
          await pb.collection('reminders').create({
            contact: remindAbout,
            activity: created.id,
            remind_at: istToUtc(remindDate, remindTime),
            notify: remindTo || $currentUser?.id,
            cc: remindCc,
            cc_emails: remindCcEmails,
            created_by: $currentUser?.id,
          });
        } catch (err: unknown) {
          const msg = (err as { response?: { message?: string } })?.response?.message;
          toasts.error(msg ? `Activity saved, but the reminder failed: ${msg}` : 'Activity saved, but the reminder could not be set');
        }
      }

      toasts.success(
        people.length === 1
          ? 'Activity logged'
          : `Activity logged for ${people.length} contacts`
      );
      // One contact → straight to their profile; several → the shared feed,
      // where the new row lists everyone.
      goto(people.length === 1 ? `${base}/contacts/${people[0].id}` : `${base}/activities`);
    } catch (err: unknown) {
      const msg = (err as { response?: { message?: string } })?.response?.message;
      toasts.error(msg || 'Failed to log activity');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Log Activity · Rolodex</title>
</svelte:head>

<div class="px-6 py-6 max-w-3xl mx-auto">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-6">
    <a href="{base}/activities" class="btn-ghost p-2" aria-label="Back to activities">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    </a>
    <div>
      <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">Log Activity</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
        One entry for everyone involved — no need to repeat it per person.
      </p>
    </div>
  </div>

  <!-- Who was involved -->
  <div class="card p-5 mb-4 space-y-2">
    <label for="act-people" class="label">
      Contacts involved *
      {#if people.length}<span class="text-neutral-400 normal-case font-normal">· {people.length}</span>{/if}
    </label>
    <ContactsPicker id="act-people" bind:selected={people} bind:roles={peopleRoles} invalid={!!peopleError} />
    {#if peopleError}
      <p class="text-xs text-red-500">{peopleError}</p>
    {:else}
      <p class="text-[11px] text-neutral-400 dark:text-neutral-500">
        Not in the Rolodex yet? Search for them, then choose “Add as a new contact”.
        Tag each person's role if it helps — who spoke, who sponsored, who volunteered.
      </p>
    {/if}
  </div>

  <!-- The activity itself -->
  <ActivityForm
    idPrefix="new-act"
    heading="What happened"
    submitLabel={people.length > 1 ? `Log for ${people.length} contacts` : 'Log Activity'}
    {saving}
    disabled={remind && remindInvalid}
    on:save={save}
    on:cancel={() => goto(`${base}/activities`)}
  >
    <!-- Optional follow-up reminder, linked to this activity -->
    <div class="border-t border-neutral-100 dark:border-neutral-800 pt-3">
      {#if !remind}
        <button type="button" on:click={toggleRemind} class="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-accent dark:hover:text-accent-dark transition-colors">
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
            <button type="button" on:click={() => (remind = false)} class="btn-ghost p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" title="Remove reminder" aria-label="Remove reminder">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {#if people.length > 1}
            <div>
              <label for="remind-about" class="label">Follow up about</label>
              <select id="remind-about" bind:value={remindAbout} class="input">
                {#each people as p (p.id)}
                  <option value={p.id}>{contactLabel(p)}</option>
                {/each}
              </select>
            </div>
          {:else if people.length === 0}
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">Add a contact above to set a follow-up.</p>
          {/if}

          <p class="text-[11px] text-neutral-500 dark:text-neutral-400">The assignee is emailed at the chosen IST time; this activity's context is included. Defaults to 10 AM. Add a CC to copy teammates or a group.</p>
          <ReminderFields
            bind:date={remindDate}
            bind:time={remindTime}
            bind:notify={remindTo}
            bind:cc={remindCc}
            bind:ccEmails={remindCcEmails}
            bind:invalid={remindInvalid}
            {users}
            currentUserId={$currentUser?.id ?? ''}
            minDate={todayStr}
            idPrefix="new-act-rem"
          />
        </div>
      {/if}
    </div>
  </ActivityForm>
</div>
