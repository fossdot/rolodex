<script lang="ts">
  import { base } from '$app/paths';
  import { createEventDispatcher } from 'svelte';
  import { toasts } from '$lib/stores';
  import type { Activity, Reaction } from '$lib/types';
  import RichText from '$lib/components/RichText.svelte';
  import Reactions from '$lib/components/Reactions.svelte';
  import { participantLabel } from '$lib/activity';

  export let act: Activity;
  export let reactions: Reaction[] = [];
  /** The permalink page already *is* the link, so it hides the copy button. */
  export let showCopyLink = true;

  const dispatch = createEventDispatcher<{ change: Reaction[] }>();

  function permalink(): string {
    return `${window.location.origin}${base}/activities/${act.id}`;
  }

  // navigator.clipboard is undefined outside a secure context — which includes
  // `npm run dev --host` over a LAN IP — so fall back to the old selection copy
  // rather than leaving the button silently dead.
  function copyFallback(text: string): boolean {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  async function copyLink() {
    const url = permalink();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (!copyFallback(url)) {
        throw new Error('copy rejected');
      }
      toasts.success('Link copied');
    } catch {
      if (copyFallback(url)) {
        toasts.success('Link copied');
      } else {
        toasts.error('Could not copy the link. Copy it from the address bar instead.');
      }
    }
  }
</script>

<div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 space-y-3">
  {#if act.notes}
    <div>
      <p class="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Notes</p>
      <RichText value={act.notes} extraClass="text-sm text-neutral-700 dark:text-neutral-300" />
    </div>
  {/if}
  <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
    {#if act.event_link}
      <a href={act.event_link} target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 text-accent dark:text-accent-dark hover:underline">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        Event link
      </a>
    {/if}
    <!-- Every participant is linked here, not just the first. -->
    {#each act.expand?.contacts ?? [] as person (person.id)}
      <a href="{base}/contacts/{person.id}" class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-accent dark:hover:text-accent-dark">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        {participantLabel(act, person)}
      </a>
    {/each}
    <span class="text-neutral-400 dark:text-neutral-500">
      logged by {act.expand?.logged_by?.name || act.expand?.logged_by?.email || 'Unknown'}
    </span>
    {#if showCopyLink}
      <button
        type="button"
        on:click={copyLink}
        title="Copy a link to this activity"
        class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 hover:text-accent dark:hover:text-accent-dark transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        Copy link
      </button>
    {/if}
  </div>

  <Reactions
    activityId={act.id}
    {reactions}
    on:change={(e) => dispatch('change', e.detail)}
  />
</div>
