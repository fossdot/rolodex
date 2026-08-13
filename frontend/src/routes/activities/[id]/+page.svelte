<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { pb } from '$lib/pb';
  import { toasts } from '$lib/stores';
  import type { Activity, Reaction } from '$lib/types';
  import { ACTIVITY_TYPES } from '$lib/constants';
  import ActivityDetail from '$lib/components/ActivityDetail.svelte';
  import { participantLine } from '$lib/activity';

  let act: Activity | null = null;
  let reactions: Reaction[] = [];
  let loading = true;
  let notFound = false;

  $: id = $page.params.id;
  $: if (id) load(id);

  async function load(activityId: string) {
    loading = true;
    notFound = false;
    try {
      act = await pb.collection('activities').getOne<Activity>(activityId, {
        // Same expand as the feed, so the shared component renders identically.
        expand: 'contacts.orgs,logged_by',
      });
    } catch {
      // A soft-deleted activity is hidden from everyone, admins included, by the
      // view rule — so it arrives here as a 404, indistinguishable from a bad id.
      // That is deliberate: there is no in-app restore, and no reason to confirm
      // to a link holder that a since-deleted activity ever existed.
      act = null;
      notFound = true;
      return;
    } finally {
      loading = false;
    }

    try {
      reactions = await pb.collection('reactions').getFullList<Reaction>({
        filter: `activity = '${activityId}'`,
        expand: 'user',
      });
    } catch {
      /* non-fatal — reactions just don't render, same as the feed */
    }
  }

  function activityLabel(v: string) {
    return ACTIVITY_TYPES.find((a) => a.value === v)?.label ?? v;
  }

  function formatDate(d: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toasts.success('Link copied');
    } catch {
      toasts.error('Could not copy the link. Copy it from the address bar instead.');
    }
  }
</script>

<svelte:head>
  <title>{act ? `${activityLabel(act.activity_type)} · Rolodex` : 'Activity · Rolodex'}</title>
</svelte:head>

<div class="px-6 py-6 max-w-3xl mx-auto">
  <a
    href="{base}/activities"
    class="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-accent dark:hover:text-accent-dark mb-5 transition-colors"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>
    All activities
  </a>

  {#if loading}
    <div class="card p-5 animate-pulse space-y-3">
      <div class="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2"></div>
      <div class="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-1/3"></div>
      <div class="h-24 bg-neutral-100 dark:bg-neutral-800 rounded"></div>
    </div>
  {:else if notFound}
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <div class="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <svg class="text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
        </svg>
      </div>
      <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">Activity not found</p>
      <p class="text-sm text-neutral-400 dark:text-neutral-500 mt-1 max-w-sm">
        It may have been removed, or the link may be wrong.
      </p>
      <a href="{base}/activities" class="btn-secondary mt-5">Back to activities</a>
    </div>
  {:else if act}
    <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">
          {activityLabel(act.activity_type)}
          {#if act.expand?.contacts?.length}
            <span class="text-neutral-400 dark:text-neutral-500 font-normal">·</span>
            <span class="text-accent dark:text-accent-dark font-normal">{participantLine(act, 3)}</span>
          {/if}
        </h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          {formatDate(act.date)}{#if act.event_name} · {act.event_name}{/if}
        </p>
      </div>
      <button type="button" on:click={copyLink} class="btn-secondary shrink-0">Copy link</button>
    </div>

    <!-- Shared with the feed's expanded row so the two can't drift. -->
    <ActivityDetail
      {act}
      {reactions}
      showCopyLink={false}
      on:change={(e) => (reactions = e.detail)}
    />
  {/if}
</div>
