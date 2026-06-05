<script lang="ts">
  /**
   * WhatsApp-style reactions for one activity. Grouped chips show each emoji
   * with its count; hovering reveals who reacted. One reaction per person —
   * picking another emoji replaces it (server-enforced), tapping your own
   * removes it.
   */
  import { createEventDispatcher } from 'svelte';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import { REACTION_EMOJIS } from '$lib/constants';
  import type { Reaction, User } from '$lib/types';

  export let activityId: string;
  export let reactions: Reaction[] = [];

  const dispatch = createEventDispatcher<{ change: Reaction[] }>();

  let items: Reaction[] = [];
  $: items = [...reactions]; // re-sync if the parent reloads

  let pickerOpen = false;
  let busy = false;

  $: mine = items.find((r) => r.user === $currentUser?.id);

  // emoji → reactions, in palette order
  $: grouped = REACTION_EMOJIS
    .map((emoji) => ({ emoji, list: items.filter((r) => r.emoji === emoji) }))
    .filter((g) => g.list.length > 0);

  function names(list: Reaction[]) {
    return list
      .map((r) => (r.user === $currentUser?.id ? 'You' : r.expand?.user?.name || r.expand?.user?.email || 'Someone'))
      .join(', ');
  }

  async function toggle(emoji: string) {
    if (busy || !$currentUser) return;
    busy = true;
    pickerOpen = false;
    try {
      if (mine && mine.emoji === emoji) {
        // tap your own reaction → remove
        await pb.collection('reactions').delete(mine.id);
        items = items.filter((r) => r.id !== mine!.id);
      } else {
        // new or different emoji → server replaces any previous one
        const rec = await pb.collection('reactions').create<Reaction>({ activity: activityId, emoji });
        rec.expand = { user: $currentUser as User };
        items = [...items.filter((r) => r.user !== $currentUser!.id), rec];
      }
      dispatch('change', items);
    } catch {
      toasts.error('Could not update reaction');
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex flex-wrap items-center gap-1 relative">
  {#each grouped as g (g.emoji)}
    <button
      on:click|stopPropagation={() => toggle(g.emoji)}
      disabled={busy}
      title={names(g.list)}
      class="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-all
        {mine?.emoji === g.emoji
          ? 'border-accent dark:border-accent-dark bg-accent/10 dark:bg-accent-dark/10'
          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'}"
    >
      <span>{g.emoji}</span>
      <span class="text-neutral-500 dark:text-neutral-400 tabular-nums">{g.list.length}</span>
    </button>
  {/each}

  <!-- add / change reaction -->
  <button
    on:click|stopPropagation={() => (pickerOpen = !pickerOpen)}
    disabled={busy}
    title="React"
    class="w-6 h-6 rounded-full border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-neutral-400 flex items-center justify-center transition-colors"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>
    </svg>
  </button>

  {#if pickerOpen}
    <div class="absolute bottom-full left-0 mb-1.5 z-20 flex items-center gap-0.5 px-1.5 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-full shadow-lg animate-fade-in">
      {#each REACTION_EMOJIS as emoji}
        <button
          on:click|stopPropagation={() => toggle(emoji)}
          class="w-7 h-7 rounded-full text-base flex items-center justify-center transition-transform hover:scale-125
            {mine?.emoji === emoji ? 'bg-accent/15 dark:bg-accent-dark/15' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}"
        >
          {emoji}
        </button>
      {/each}
    </div>
  {/if}
</div>
