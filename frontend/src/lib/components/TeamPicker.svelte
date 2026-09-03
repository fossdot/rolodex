<script lang="ts">
  /**
   * Tags the FOSS United members who were part of an activity (issue #26) —
   * everyone besides whoever is logging it, who is on it by definition.
   *
   * Holds user ids; the parent sends them as `team`. Members who have left
   * (`disabled`) are not offered, but stay listed when an older activity already
   * names them, so editing it doesn't silently drop them from history.
   *
   * A plain dropdown rather than a search box: the team is a dozen people, and
   * every one of them fits on one list.
   */
  import { onMount } from 'svelte';
  import { pb } from '$lib/pb';
  import type { User } from '$lib/types';
  import { userLabel } from '$lib/activity';
  import Avatar from './Avatar.svelte';

  export let selected: string[] = [];
  /** The member logging the activity — never offered, since they're on it already. */
  export let exclude = '';
  export let id = 'team-picker';

  let users: User[] = [];
  let loaded = false;
  onMount(async () => {
    try {
      users = await pb.collection('users').getFullList<User>({ sort: 'name' });
    } catch {
      /* non-fatal — the picker just offers nobody */
    } finally {
      loaded = true;
    }
  });

  $: byId = new Map(users.map((u) => [u.id, u]));
  $: options = users.filter((u) => u.id !== exclude && !u.disabled && !selected.includes(u.id));

  // The dropdown is a one-shot "add" control: picking someone appends them and
  // the box snaps back to its prompt, so it's never left showing a stale name.
  let draft = '';
  $: if (draft) {
    if (draft !== exclude && !selected.includes(draft)) selected = [...selected, draft];
    draft = '';
  }

  function remove(uid: string) {
    selected = selected.filter((s) => s !== uid);
  }
</script>

<div>
  <label for={id} class="label">
    Team members <span class="text-neutral-400 normal-case font-normal">(optional)</span>
    {#if selected.length}<span class="text-neutral-400 normal-case font-normal">· {selected.length}</span>{/if}
  </label>

  {#if selected.length}
    <ul class="flex flex-wrap gap-1.5 mb-2">
      {#each selected as uid (uid)}
        {@const u = byId.get(uid)}
        <li class="inline-flex items-center gap-1.5 pl-1 pr-1 py-1 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          <Avatar name={u ? userLabel(u) : '?'} size="sm" />
          <span class="leading-tight">{u ? userLabel(u) : loaded ? 'Unknown member' : '…'}</span>
          {#if u?.disabled}
            <span class="text-neutral-400 dark:text-neutral-500">· no longer active</span>
          {/if}
          <button
            type="button"
            on:click={() => remove(uid)}
            class="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
            title="Remove"
            aria-label="Remove {u ? userLabel(u) : 'member'}"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if options.length}
    <select {id} bind:value={draft} class="input w-auto min-w-56">
      <option value="">{selected.length ? 'Add another teammate…' : 'Who else from the team was there?'}</option>
      {#each options as u (u.id)}
        <option value={u.id}>{userLabel(u)}</option>
      {/each}
    </select>
  {:else if loaded && users.length}
    <p class="text-[11px] text-neutral-400 dark:text-neutral-500">Everyone on the team is tagged.</p>
  {/if}

  <p class="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
    Tag colleagues who were also part of this. They're emailed a summary, can edit the entry, and its contacts show under
    their My Contacts — the activity itself stays credited to whoever logs it.
  </p>
</div>
