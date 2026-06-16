<script lang="ts">
  /**
   * Organisation input with autocomplete over orgs already in the database —
   * nudges everyone toward one spelling per org so the /orgs grouping stays
   * clean. Suggestions are fetched once by the parent and passed in.
   */
  export let value = '';
  export let id = '';
  export let placeholder = 'GNOME Foundation';
  export let suggestions: string[] = [];
  export let extraClass = '';

  let open = false;
  let highlighted = -1;

  $: matches = value.trim().length > 0
    ? suggestions.filter((o) => o.toLowerCase().includes(value.toLowerCase()) && o !== value).slice(0, 9)
    : [];

  // Close when nothing matches. Opening happens only on user typing (below),
  // never reactively — otherwise a pre-filled value would pop the dropdown
  // open on the edit page load.
  $: if (matches.length === 0) open = false;

  function pick(org: string) {
    value = org;
    open = false;
    highlighted = -1;
  }

  function handleBlur() {
    setTimeout(() => {
      open = false;
      highlighted = -1;
    }, 120);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, matches.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      pick(matches[highlighted]);
    } else if (e.key === 'Escape') {
      open = false;
      highlighted = -1;
    }
  }
</script>

<div class="relative">
  <input
    {id}
    type="text"
    bind:value
    on:input={() => { open = true; highlighted = -1; }}
    on:blur={handleBlur}
    on:keydown={handleKeydown}
    {placeholder}
    autocomplete="off"
    spellcheck="false"
    class="input {extraClass}"
  />

  {#if open && matches.length > 0}
    <ul class="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto animate-fade-in">
      {#each matches as org, i}
        <li>
          <button
            type="button"
            on:mousedown|preventDefault={() => pick(org)}
            class="w-full text-left px-3 py-2 text-sm transition-colors
              {i === highlighted
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
          >
            {org}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
