<script lang="ts">
  // Renders user-authored rich text, sanitized at render time (defence in
  // depth — content is also sanitized before saving).
  import { sanitizeHtml } from '$lib/sanitizeHtml';

  export let value = '';
  export let extraClass = '';

  $: html = sanitizeHtml(value);
</script>

{#if html}
  <div class="richtext {extraClass}">{@html html}</div>
{/if}
