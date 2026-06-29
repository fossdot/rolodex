<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { pb } from '$lib/pb';
  import { currentUser } from '$lib/stores';
  import type { Reminder } from '$lib/types';

  // 'right' → opens to the right of the sidebar; 'bottom-end' → drops below a top bar.
  export let placement: 'right' | 'bottom-end' = 'right';

  let open = false;
  let loading = false;
  let pending: Reminder[] = [];
  let sent: Reminder[] = [];
  let root: HTMLElement;

  $: me = $currentUser?.id ?? '';
  $: panelPos = placement === 'right'
    ? 'left-full top-0 ml-2'
    : 'right-0 top-full mt-2';

  function fmtIST(d?: string) {
    if (!d) return '';
    return new Date(String(d).replace(' ', 'T')).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }) + ' IST';
  }

  function contactName(r: Reminder) {
    const c = r.expand?.contact;
    return c ? (c.name || c.org || 'Contact') : 'Contact';
  }

  function activityLine(r: Reminder) {
    const a = r.expand?.activity;
    if (!a) return '';
    const type = String(a.activity_type || '').split('_').map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
    return [type, a.event_name].filter(Boolean).join(' · ');
  }

  async function load() {
    if (!me) return;
    loading = true;
    try {
      const [p, s] = await Promise.all([
        pb.collection('reminders').getFullList<Reminder>({
          filter: `notify = '${me}' && sent_at = ''`,
          sort: 'remind_at',
          expand: 'contact,activity',
        }),
        pb.collection('reminders').getList<Reminder>(1, 25, {
          filter: `notify = '${me}' && sent_at != ''`,
          sort: '-remind_at',
          expand: 'contact,activity',
        }).then((r) => r.items),
      ]);
      pending = p;
      sent = s;
    } catch {
      /* non-fatal — bell just shows nothing */
    } finally {
      loading = false;
    }
  }

  function toggle() {
    open = !open;
    if (open) load();
  }

  function openReminder(r: Reminder) {
    open = false;
    goto(`${base}/contacts/${r.contact}`);
  }

  function onWindowClick(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }

  onMount(load); // prime the badge count
</script>

<svelte:window on:click={onWindowClick} on:keydown={onKeydown} />

<div class="relative" bind:this={root}>
  <button
    on:click|stopPropagation={toggle}
    class="btn-ghost relative p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
    title="Reminders"
    aria-label="Reminders"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
    {#if pending.length}
      <span class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-accent dark:bg-accent-dark text-white text-[10px] font-semibold leading-none">
        {pending.length}
      </span>
    {/if}
  </button>

  {#if open}
    <div class="absolute z-50 {panelPos} w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl animate-fade-in">
      <div class="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-900">
        <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Your reminders</h3>
      </div>

      {#if loading}
        <div class="px-4 py-6 flex justify-center">
          <div class="w-4 h-4 border-2 border-neutral-200 border-t-neutral-500 dark:border-neutral-700 dark:border-t-neutral-300 rounded-full animate-spin"></div>
        </div>
      {:else if !pending.length && !sent.length}
        <div class="px-4 py-8 text-center">
          <p class="text-sm text-neutral-500 dark:text-neutral-400">No reminders yet</p>
          <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Add a follow-up on an activity to get a nudge.</p>
        </div>
      {:else}
        {#if pending.length}
          <div class="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Upcoming</div>
          {#each pending as r (r.id)}
            <button on:click={() => openReminder(r)} class="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors flex gap-2.5 items-start">
              <svg class="text-accent dark:text-accent-dark shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              <div class="min-w-0">
                <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{contactName(r)}</p>
                {#if activityLine(r)}<p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{activityLine(r)}</p>{/if}
                <p class="text-xs text-accent dark:text-accent-dark mt-0.5">{fmtIST(r.remind_at)}</p>
              </div>
            </button>
          {/each}
        {/if}

        {#if sent.length}
          <div class="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Sent</div>
          {#each sent as r (r.id)}
            <button on:click={() => openReminder(r)} class="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors flex gap-2.5 items-start opacity-75">
              <svg class="text-neutral-400 shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              <div class="min-w-0">
                <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">{contactName(r)}</p>
                {#if activityLine(r)}<p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{activityLine(r)}</p>{/if}
                <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Reminded {fmtIST(r.remind_at)}</p>
              </div>
            </button>
          {/each}
        {/if}
      {/if}
    </div>
  {/if}
</div>
