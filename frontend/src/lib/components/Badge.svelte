<script lang="ts">
  export let variant: 'green' | 'neutral' = 'neutral';
</script>

<span class="{variant === 'green' ? 'badge-green' : 'badge-neutral'}">
  <slot />
</span>
