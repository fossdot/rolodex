<script lang="ts">
  export let options: { value: string; label: string }[] = [];
  export let selected: string[] = [];
  export let label: string = '';
  export let columns: 2 | 3 = 2;

  function toggle(value: string) {
    if (selected.includes(value)) {
      selected = selected.filter((v) => v !== value);
    } else {
      selected = [...selected, value];
    }
  }
</script>

<div>
  {#if label}
    <span class="label">{label}</span>
  {/if}
  <!-- single column on phones — the long role labels need the width -->
  <div class="grid gap-2 {columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}">
    {#each options as opt}
      <button
        type="button"
        on:click={() => toggle(opt.value)}
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-all duration-100 select-none text-left
          {selected.includes(opt.value)
            ? 'border-accent dark:border-accent-dark bg-accent-subtle dark:bg-accent-dark-subtle text-accent dark:text-accent-dark font-medium'
            : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'}"
      >
        <span class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
          {selected.includes(opt.value)
            ? 'border-accent dark:border-accent-dark bg-accent dark:bg-accent-dark'
            : 'border-neutral-300 dark:border-neutral-600'}">
          {#if selected.includes(opt.value)}
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          {/if}
        </span>
        <span class="leading-tight">{opt.label}</span>
      </button>
    {/each}
  </div>
</div>
