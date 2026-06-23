<script lang="ts">
  import { shortcutsHelp } from '$lib/stores';

  // Show ⌘ on Mac, Ctrl elsewhere.
  const isMac =
    typeof navigator !== 'undefined' &&
    (/Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac/.test(navigator.userAgent));
  const mod = isMac ? '⌘' : 'Ctrl';

  // Each shortcut is a list of key-chips; a group joined with "or".
  const groups: { keys: string[][]; label: string }[] = [
    { keys: [['/'], [mod, 'K']], label: 'Search the current page' },
    { keys: [['N'], [mod, 'N']], label: 'Add a new contact' },
    { keys: [[mod, 'S']], label: 'Save the contact form' },
    { keys: [['?']], label: 'Show this help' },
  ];

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') $shortcutsHelp && shortcutsHelp.close();
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $shortcutsHelp}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-[70] flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
  >
    <div class="absolute inset-0 bg-black/40 animate-fade-in" on:click={shortcutsHelp.close}></div>
    <div class="relative w-full max-w-md card p-0 overflow-hidden animate-fade-in">
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Keyboard shortcuts</h2>
        <button
          on:click={shortcutsHelp.close}
          class="btn-ghost p-1.5 -mr-1.5"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="px-5 py-4 flex flex-col gap-3">
        {#each groups as g}
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm text-neutral-600 dark:text-neutral-300">{g.label}</span>
            <span class="flex items-center gap-1.5 shrink-0">
              {#each g.keys as combo, i}
                {#if i > 0}<span class="text-xs text-neutral-400">or</span>{/if}
                <span class="flex items-center gap-1">
                  {#each combo as k}
                    <kbd class="min-w-[1.6rem] text-center px-1.5 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 shadow-sm">{k}</kbd>
                  {/each}
                </span>
              {/each}
            </span>
          </div>
        {/each}
      </div>
      <div class="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400 dark:text-neutral-500">
        Press <kbd class="px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">?</kbd> anytime to open this.
      </div>
    </div>
  </div>
{/if}
