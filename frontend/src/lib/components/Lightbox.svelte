<script lang="ts">
  /**
   * Minimal full-screen image overlay — no library. The `src` should only be
   * assigned when the user opens it, so the full-size image is never fetched
   * on initial page load.
   */
  export let src = '';
  export let alt = '';
  export let open = false;

  function close() {
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open && src}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-6 animate-fade-in cursor-zoom-out"
    on:click={close}
  >
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <img
      {src}
      {alt}
      class="max-w-[92vw] max-h-[92vh] object-contain rounded-xl shadow-2xl"
      on:click|stopPropagation
    />
    <button
      on:click={close}
      class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      title="Close (Esc)"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>
  </div>
{/if}
