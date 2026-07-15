<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ACTIVITY_TYPES } from '$lib/constants';
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  import { sanitizeHtml, htmlToText } from '$lib/sanitizeHtml';
  import type { Activity } from '$lib/types';

  // `initial` seeds the fields once, on mount — `{}` for a new activity, the
  // record for an edit. The form owns its own field state, so each open mounts
  // fresh and closing destroys it; there is no shared variable to go stale
  // between sessions (this is what keeps the notes field from leaking between
  // activities — issue #1).
  export let initial: Partial<Activity> = {};
  export let heading = 'Log new activity';
  export let submitLabel = 'Save Activity';
  export let saving = false;
  // Unique per instance so two forms (create + an inline edit) never collide on
  // DOM ids / label associations.
  export let idPrefix = 'act';
  export let extraClass = '';

  const todayStr = new Date().toISOString().split('T')[0];

  let type = initial.activity_type ?? '';
  let event = initial.event_name ?? '';
  let link = initial.event_link ?? '';
  let date = initial.date || todayStr;
  let notes = initial.notes ?? '';
  let errors: Record<string, string> = {};

  const dispatch = createEventDispatcher<{
    save: { activity_type: string; event_name: string; event_link: string; date: string; notes: string };
    cancel: void;
  }>();

  function submit() {
    errors = {};
    if (!type) errors.type = 'Select an activity type.';
    if (!event.trim()) errors.event = 'Event / context is required.';
    if (!htmlToText(notes).trim()) errors.notes = 'Notes are required.';
    if (Object.keys(errors).length) return;

    dispatch('save', {
      activity_type: type,
      event_name: event.trim(),
      event_link: link.trim(),
      date,
      notes: sanitizeHtml(notes),
    });
  }
</script>

<div class="card p-5 animate-fade-in space-y-4 {extraClass}">
  <h3 class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{heading}</h3>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <label for="{idPrefix}-type" class="label">Activity Type *</label>
      <select id="{idPrefix}-type" bind:value={type} class="input {errors.type ? 'ring-2 ring-red-400' : ''}">
        <option value="">Select type…</option>
        {#each ACTIVITY_TYPES as t}
          <option value={t.value}>{t.label}</option>
        {/each}
      </select>
      {#if errors.type}<p class="text-xs text-red-500 mt-1">{errors.type}</p>{/if}
    </div>
    <div>
      <label for="{idPrefix}-date" class="label">Date</label>
      <input id="{idPrefix}-date" type="date" bind:value={date} class="input" />
    </div>
    <div class="sm:col-span-2">
      <label for="{idPrefix}-event" class="label">Event / Context *</label>
      <input id="{idPrefix}-event" type="text" bind:value={event} class="input {errors.event ? 'ring-2 ring-red-400' : ''}" placeholder="IndiaFOSS 2025, FOSS United Delhi Meetup…" />
      {#if errors.event}<p class="text-xs text-red-500 mt-1">{errors.event}</p>{/if}
    </div>
    <div class="sm:col-span-2">
      <label for="{idPrefix}-link" class="label">Event Link <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
      <input id="{idPrefix}-link" type="url" bind:value={link} class="input" placeholder="https://fossunited.org/events/…" />
    </div>
    <div class="sm:col-span-2">
      <label for="{idPrefix}-notes" class="label">Notes *</label>
      <RichTextEditor id="{idPrefix}-notes" bind:value={notes} invalid={!!errors.notes} placeholder="What happened, follow-ups, context…" />
      {#if errors.notes}<p class="text-xs text-red-500 mt-1">{errors.notes}</p>{/if}
    </div>
  </div>

  <slot />

  <div class="flex justify-end gap-2">
    <button on:click={() => dispatch('cancel')} class="btn-secondary text-sm py-1.5">Cancel</button>
    <button on:click={submit} disabled={saving} class="btn-primary text-sm py-1.5">
      {#if saving}
        <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        Saving…
      {:else}
        {submitLabel}
      {/if}
    </button>
  </div>
</div>
