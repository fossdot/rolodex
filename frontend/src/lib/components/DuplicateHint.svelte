<script lang="ts">
  /**
   * "Already in the Rolodex?" — the soft duplicate check on both contact forms
   * (issue #27). Watches the name, email and mobile being typed, asks the server
   * for anyone who looks like the same person, and lists them with a way out:
   * open their profile, or — in the activity flow — use them instead of creating
   * a second copy. It never blocks the save: two people can share a name.
   */
  import { createEventDispatcher } from 'svelte';
  import { base } from '$app/paths';
  import type { Contact } from '$lib/types';
  import { findPossibleDuplicates, type DuplicateMatch, type DuplicateReason } from '$lib/duplicates';
  import { contactLabel, orgLine } from '$lib/org';
  import Avatar from './Avatar.svelte';

  export let name = '';
  export let email = '';
  export let mobile = '';
  /** When set, each row offers this action and dispatches `pick` instead of linking to the profile. */
  export let pickLabel = '';

  const dispatch = createEventDispatcher<{ pick: Contact }>();

  let matches: DuplicateMatch[] = [];
  let timer: ReturnType<typeof setTimeout>;
  let seq = 0;

  // Debounced, and sequenced: a slow answer to an earlier keystroke is dropped
  // rather than overwriting the one for what's in the box now.
  $: {
    const input = { name, email, mobile };
    clearTimeout(timer);
    timer = setTimeout(() => run(input), 300);
  }

  async function run(input: { name: string; email: string; mobile: string }) {
    const mine = ++seq;
    try {
      const found = await findPossibleDuplicates(input);
      if (mine === seq) matches = found;
    } catch {
      if (mine === seq) matches = []; // a failed lookup just means no hint
    }
  }

  const badge = (r: DuplicateReason) => (r === 'email' ? 'same email' : r === 'mobile' ? 'same mobile' : 'similar name');
  const via = (c: Contact) => c.expand?.added_by?.name || c.expand?.added_by?.email || '';
  const sub = (c: Contact) => [c.designation, orgLine(c)].filter(Boolean).join(' · ');
</script>

{#if matches.length}
  <div class="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 animate-fade-in" role="status">
    <p class="text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
      Already in the Rolodex?
    </p>
    <p class="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
      {matches.length === 1 ? 'Someone who looks like this person is already here.' : 'These people look like they could be the same person.'}
      Check before adding a second copy.
    </p>
    <ul class="mt-2 space-y-1.5">
      {#each matches as m (m.contact.id)}
        <li class="flex items-center gap-2 text-xs min-w-0">
          <Avatar name={contactLabel(m.contact)} size="sm" />
          <span class="min-w-0 flex-1 truncate">
            <span class="text-neutral-900 dark:text-neutral-100 font-medium">{contactLabel(m.contact)}</span>
            {#if sub(m.contact)}<span class="text-neutral-500 dark:text-neutral-400"> · {sub(m.contact)}</span>{/if}
            {#if via(m.contact)}<span class="text-neutral-400 dark:text-neutral-500"> · via {via(m.contact)}</span>{/if}
          </span>
          {#each m.reasons as r (r)}
            <span class="badge-neutral text-[10px] shrink-0">{badge(r)}</span>
          {/each}
          {#if pickLabel}
            <button type="button" on:click={() => dispatch('pick', m.contact)} class="btn-secondary text-[11px] py-0.5 px-2 shrink-0">{pickLabel}</button>
          {:else}
            <!-- A new tab, so the half-filled form isn't lost while they compare. -->
            <a href="{base}/contacts/{m.contact.id}" target="_blank" rel="noopener noreferrer" class="text-accent dark:text-accent-dark hover:underline text-[11px] shrink-0">Open ↗</a>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
