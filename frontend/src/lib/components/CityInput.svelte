<script lang="ts">
  import { CITIES, normalizeCity } from '$lib/constants';

  export let value = '';
  export let id = '';
  export let placeholder = 'Bangalore';
  export let extraClass = '';

  let open = false;
  let highlighted = -1;

  $: suggestions = value.trim().length > 0
    ? CITIES.filter((c) => c.toLowerCase().includes(value.toLowerCase())).slice(0, 9)
    : [];

  // Close when nothing matches. Opening happens only on user typing (below),
  // never reactively — otherwise a pre-filled value (e.g. on the edit page)
  // would pop the dropdown open on load.
  $: if (suggestions.length === 0) open = false;

  function pick(city: string) {
    value = city;
    open = false;
    highlighted = -1;
  }

  function handleBlur() {
    setTimeout(() => {
      value = normalizeCity(value);
      open = false;
      highlighted = -1;
    }, 120);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      pick(suggestions[highlighted]);
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

  {#if open && suggestions.length > 0}
    <ul class="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto animate-fade-in">
      {#each suggestions as city, i}
        <li>
          <button
            type="button"
            on:mousedown|preventDefault={() => pick(city)}
            class="w-full text-left px-3 py-2 text-sm transition-colors
              {i === highlighted
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
          >
            {city}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
