<script lang="ts">
  export let name: string = '';
  export let size: 'sm' | 'md' | 'lg' = 'md';

  const COLORS = [
    'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
    'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  ];

  function getInitials(n: string) {
    if (!n) return '?';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getColor(n: string) {
    let hash = 0;
    for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  $: initials = getInitials(name);
  $: color = getColor(name || '?');
  $: sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
</script>

<div class="rounded-full flex items-center justify-center font-semibold shrink-0 {sizeClass} {color}">
  {initials}
</div>
