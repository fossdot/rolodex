<script lang="ts">
  /**
   * Picks the contacts an activity involved (issue #6) — search the Rolodex,
   * add as many as attended, and create anyone who isn't there yet without
   * leaving the page.
   *
   * Holds whole Contact records rather than ids so the chips can show a name and
   * organisation without a second fetch; the parent reads `.id` off them.
   */
  import { pb } from '$lib/pb';
  import type { Contact } from '$lib/types';
  import { contactLabel, primaryOrg } from '$lib/org';
  import { PARTICIPANT_ROLES } from '$lib/constants';
  import Avatar from './Avatar.svelte';
  import ContactQuickAdd from './ContactQuickAdd.svelte';

  export let selected: Contact[] = [];
  /**
   * Each participant's part in this activity, keyed by contact id. Bindable, and
   * reassigned rather than mutated so the parent sees the change.
   */
  export let roles: Record<string, string> = {};
  export let id = 'contacts-picker';
  export let invalid = false;
  export let max = 50;

  let query = '';
  let results: Contact[] = [];
  let open = false;
  let searching = false;
  let highlighted = -1;
  let quickAddOpen = false;
  let searchSeq = 0;
  let debounceTimer: ReturnType<typeof setTimeout>;

  $: selectedIds = new Set(selected.map((c) => c.id));
  $: atMax = selected.length >= max;
  // Results minus whoever is already on the activity.
  $: shown = results.filter((c) => !selectedIds.has(c.id));

  async function runSearch() {
    const q = query.trim();
    if (!q) {
      results = [];
      searching = false;
      return;
    }
    const seq = ++searchSeq;
    searching = true;
    const esc = q.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    try {
      const r = await pb.collection('contacts').getList<Contact>(1, 8, {
        filter: `deleted_at = null && (name ~ '${esc}' || orgs.name ?~ '${esc}' || email ~ '${esc}' || mobile ~ '${esc}')`,
        sort: 'name',
        expand: 'orgs',
      });
      if (seq !== searchSeq) return; // a newer search superseded this one
      results = r.items;
    } catch {
      if (seq === searchSeq) results = [];
    } finally {
      if (seq === searchSeq) searching = false;
    }
  }

  function onInput() {
    open = true;
    highlighted = -1;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 250);
  }

  function add(c: Contact) {
    if (atMax || selectedIds.has(c.id)) return;
    selected = [...selected, c];
    query = '';
    results = [];
    open = false;
    highlighted = -1;
  }

  function remove(c: Contact) {
    selected = selected.filter((s) => s.id !== c.id);
    // Drop the role with the person, so nothing stale is submitted. (The server
    // prunes it too, but the form shouldn't send it in the first place.)
    if (c.id in roles) {
      const { [c.id]: _dropped, ...rest } = roles;
      roles = rest;
    }
  }

  // Reassign rather than mutate — `roles[id] = v` would not reach the parent.
  function setRole(contactId: string, role: string) {
    if (role) roles = { ...roles, [contactId]: role };
    else {
      const { [contactId]: _cleared, ...rest } = roles;
      roles = rest;
    }
  }

  function handleBlur() {
    setTimeout(() => {
      open = false;
      highlighted = -1;
    }, 150);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Backspace' && !query && selected.length) {
      e.preventDefault();
      remove(selected[selected.length - 1]);
      return;
    }
    if (e.key === 'Escape') {
      open = false;
      highlighted = -1;
      return;
    }
    if (!open || !shown.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, shown.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0) add(shown[highlighted]);
    }
  }

  function onCreated(e: CustomEvent<Contact>) {
    add(e.detail);
    quickAddOpen = false;
  }
</script>

<div>
  {#if selected.length}
    <ul class="flex flex-wrap gap-1.5 mb-2">
      {#each selected as c (c.id)}
        <li class="inline-flex items-center gap-1.5 pl-1 pr-1 py-1 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          <Avatar name={contactLabel(c)} size="sm" />
          <span class="leading-tight">{contactLabel(c)}</span>
          {#if primaryOrg(c)}
            <span class="text-neutral-400 dark:text-neutral-500">· {primaryOrg(c)}</span>
          {/if}
          <!-- Their part in *this* activity — one person may speak while another
               sponsors. Optional; left blank it simply isn't recorded. -->
          <select
            value={roles[c.id] ?? ''}
            on:change={(e) => setRole(c.id, e.currentTarget.value)}
            aria-label="Role for {contactLabel(c)}"
            class="ml-0.5 rounded-md border px-1 py-0.5 text-[11px] font-medium bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-accent dark:focus:ring-accent-dark
              {roles[c.id]
                ? 'border-accent/50 dark:border-accent-dark/50 text-accent dark:text-accent-dark'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500'}"
          >
            <option value="">Role…</option>
            {#each PARTICIPANT_ROLES as r (r.value)}
              <option value={r.value}>{r.label}</option>
            {/each}
          </select>
          <button
            type="button"
            on:click={() => remove(c)}
            class="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
            title="Remove"
            aria-label="Remove {contactLabel(c)}"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if !atMax}
    <div class="relative">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        {id}
        type="text"
        bind:value={query}
        on:input={onInput}
        on:focus={() => (open = true)}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        placeholder={selected.length ? 'Add another person…' : 'Search the Rolodex by name, org, email…'}
        autocomplete="off"
        class="input pl-9 {invalid ? 'ring-2 ring-red-400' : ''}"
      />

      {#if open && query.trim()}
        <ul class="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto animate-fade-in">
          {#if searching}
            <li class="px-3 py-2.5 text-sm text-neutral-400 dark:text-neutral-500">Searching…</li>
          {:else}
            {#each shown as c, i (c.id)}
              <li>
                <button
                  type="button"
                  on:mousedown|preventDefault={() => add(c)}
                  class="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors
                    {i === highlighted ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
                >
                  <Avatar name={contactLabel(c)} size="sm" />
                  <span class="min-w-0">
                    <span class="block truncate text-neutral-900 dark:text-neutral-100">{contactLabel(c)}</span>
                    {#if primaryOrg(c) || c.designation}
                      <span class="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {[c.designation, primaryOrg(c)].filter(Boolean).join(' · ')}
                      </span>
                    {/if}
                  </span>
                </button>
              </li>
            {/each}
            {#if !shown.length}
              <li class="px-3 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">
                No match for “{query.trim()}”
              </li>
            {/if}
            <!-- Always offered: the person may exist under a spelling you can't guess. -->
            <li class="border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                on:mousedown|preventDefault={() => (quickAddOpen = true)}
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2"
              >
                <svg class="text-accent dark:text-accent-dark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>
                <span class="text-accent dark:text-accent-dark font-medium">Add “{query.trim()}” as a new contact</span>
              </button>
            </li>
          {/if}
        </ul>
      {/if}
    </div>
  {:else}
    <p class="text-xs text-neutral-400 dark:text-neutral-500">Maximum of {max} contacts on one activity.</p>
  {/if}
</div>

<ContactQuickAdd bind:open={quickAddOpen} initialName={query.trim()} on:created={onCreated} />
