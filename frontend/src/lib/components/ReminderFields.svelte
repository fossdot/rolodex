<script lang="ts">
  import MultiSelect from '$lib/components/MultiSelect.svelte';
  import type { User } from '$lib/types';

  export let date = '';
  export let time = '10:00';
  export let notify = '';
  /** Team members copied on the email. Email only — the bell stays personal. */
  export let cc: string[] = [];
  /** Free-text external addresses (a Google group, a partner without an account). */
  export let ccEmails = '';
  export let users: User[] = [];
  export let currentUserId = '';
  export let minDate = '';
  export let idPrefix = 'rem';
  /** Bindable — lets the parent disable Save while an address is malformed. */
  export let invalid = false;

  function userLabel(u: User) {
    return (u.name || u.email) + (u.id === currentUserId ? ' (me)' : '');
  }

  // The assignee is the To, so never offer them as a CC as well.
  $: ccOptions = users.filter((u) => u.id !== notify).map((u) => ({ value: u.id, label: userLabel(u) }));

  // Reassigning to someone already CC'd would otherwise email them twice.
  $: if (notify && cc.includes(notify)) cc = cc.filter((id) => id !== notify);

  // Mirrors the check in pb_hooks/reachout.pb.js so a typo surfaces here rather
  // than as a rejected save.
  const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  $: externalCc = ccEmails.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  $: badEmails = externalCc.filter((s) => !EMAIL_RE.test(s));
  $: invalid = badEmails.length > 0;
  $: ccCount = cc.length + externalCc.length;

  // Editing a reminder that already has CCs should show them, not hide them.
  let showCc = false;
  $: if (ccCount > 0) showCc = true;
</script>

<div class="grid grid-cols-2 gap-2">
  <div>
    <label for="{idPrefix}-date" class="label">Reach out on</label>
    <input id="{idPrefix}-date" type="date" bind:value={date} min={minDate} class="input" />
  </div>
  <div>
    <label for="{idPrefix}-time" class="label">Time <span class="text-neutral-400 normal-case font-normal">(IST)</span></label>
    <input id="{idPrefix}-time" type="time" bind:value={time} class="input" />
  </div>
</div>
<div class="mt-3">
  <label for="{idPrefix}-notify" class="label">Notify</label>
  <select id="{idPrefix}-notify" bind:value={notify} class="input">
    {#each users as u (u.id)}
      <option value={u.id}>{userLabel(u)}</option>
    {/each}
  </select>
</div>

<div class="mt-3">
  {#if !showCc}
    <button
      type="button"
      on:click={() => (showCc = true)}
      class="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-accent dark:hover:text-accent-dark transition-colors"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>
      Add CC
    </button>
  {:else}
    <div class="animate-fade-in space-y-3">
      <div class="flex items-center justify-between gap-2">
        <span class="label mb-0">CC {#if ccCount}<span class="text-neutral-400 normal-case font-normal">· {ccCount}</span>{/if}</span>
        {#if ccCount === 0}
          <button
            type="button"
            on:click={() => (showCc = false)}
            class="btn-ghost p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            title="Remove CC"
            aria-label="Remove CC"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        {/if}
      </div>

      {#if ccOptions.length}
        <MultiSelect options={ccOptions} bind:selected={cc} columns={2} />
      {/if}

      <div>
        <label for="{idPrefix}-cc-emails" class="label">
          Other addresses <span class="text-neutral-400 normal-case font-normal">(comma separated)</span>
        </label>
        <input
          id="{idPrefix}-cc-emails"
          type="text"
          bind:value={ccEmails}
          autocomplete="off"
          spellcheck="false"
          placeholder="team@fossunited.org, community@fossunited.org"
          class="input {badEmails.length ? 'ring-2 ring-red-400' : ''}"
        />
        {#if badEmails.length}
          <p class="text-xs text-red-500 mt-1">
            Not {badEmails.length === 1 ? 'a valid address' : 'valid addresses'}: {badEmails.join(', ')}
          </p>
        {/if}
      </div>
    </div>
  {/if}
</div>
