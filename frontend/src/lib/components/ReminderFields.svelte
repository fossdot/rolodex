<script lang="ts">
  import type { User } from '$lib/types';

  export let date = '';
  export let time = '10:00';
  export let notify = '';
  export let users: User[] = [];
  export let currentUserId = '';
  export let minDate = '';
  export let idPrefix = 'rem';
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
      <option value={u.id}>{u.name || u.email}{u.id === currentUserId ? ' (me)' : ''}</option>
    {/each}
  </select>
</div>
