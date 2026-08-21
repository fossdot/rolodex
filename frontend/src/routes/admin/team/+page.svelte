<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { User } from '$lib/types';
  import Avatar from '$lib/components/Avatar.svelte';

  let members: User[] = [];
  let loading = true;
  let busy = ''; // id of the member whose row is mid-request

  // Invite form
  let showInvite = false;
  let inviteEmail = '';
  let inviteName = '';
  let inviteRole: 'admin' | 'employee' = 'employee';
  let inviting = false;

  $: admins = members.filter((m) => m.role === 'admin' && !m.disabled).length;
  $: active = members.filter((m) => !m.disabled).length;

  // PocketBase puts the useful part of a failure in response.message — the
  // guardrail hooks answer with sentences meant to be read ("Rolodex needs at
  // least one active admin"), so show those rather than a generic apology.
  function reason(e: unknown, fallback: string): string {
    const r = e as { response?: { message?: string }; message?: string };
    return r?.response?.message || r?.message || fallback;
  }

  async function load() {
    if ($currentUser?.role !== 'admin') {
      goto(`${base}/contacts`);
      return;
    }
    loading = true;
    try {
      members = await pb.collection('users').getFullList<User>({ sort: 'name' });
    } catch (e) {
      toasts.error(reason(e, 'Could not load the team'));
    } finally {
      loading = false;
    }
  }

  onMount(load);

  // The cast lives here rather than in the markup: Svelte's template parser
  // rejects a TS `as` inside an event handler expression.
  function onRoleChange(m: User, ev: Event) {
    const select = ev.currentTarget as HTMLSelectElement;
    setRole(m, select.value);
  }

  async function setRole(m: User, role: string) {
    busy = m.id;
    try {
      await pb.collection('users').update(m.id, { role });
      toasts.success(`${m.name || 'Member'} is now ${role === 'admin' ? 'an admin' : 'an employee'}`);
      await load();
    } catch (e) {
      toasts.error(reason(e, 'Could not change the role'));
      await load(); // the select is bound to the row, so put it back
    } finally {
      busy = '';
    }
  }

  async function setAccess(m: User, disabled: boolean) {
    if (disabled && !confirm(`Remove ${m.name || 'this member'}'s access? They keep their name on everything they added, and you can restore access later.`)) return;
    busy = m.id;
    try {
      await pb.collection('users').update(m.id, { disabled });
      toasts.success(disabled ? `${m.name || 'Member'} can no longer sign in` : `${m.name || 'Member'} has access again`);
      await load();
    } catch (e) {
      toasts.error(reason(e, 'Could not change access'));
    } finally {
      busy = '';
    }
  }

  // Their address isn't in the roster — emailVisibility is false on user
  // records — so an admin-only route does the lookup and the sending.
  async function sendPasswordEmail(m: User) {
    busy = m.id;
    try {
      await pb.send('/api/team/send-password-reset', { method: 'POST', body: { member: m.id } });
      toasts.success(`Password link emailed to ${m.name || 'them'}`);
    } catch (e) {
      toasts.error(reason(e, 'Could not send the email'));
    } finally {
      busy = '';
    }
  }

  function randomPassword(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function invite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email.endsWith('@fossunited.org')) {
      toasts.error('Rolodex accounts must use an @fossunited.org address');
      return;
    }
    inviting = true;
    try {
      // A throwaway password nobody is told: they set their own from the email.
      const password = randomPassword();
      await pb.collection('users').create({
        email,
        name: inviteName.trim() || email.split('@')[0],
        role: inviteRole,
        password,
        passwordConfirm: password,
        emailVisibility: false,
      });
      // The account exists from here on. If the email fails, say so plainly:
      // retrying the invite would only collide on the address, and the row's
      // "Password link" button is the way to try the email again.
      try {
        await pb.collection('users').requestPasswordReset(email);
        toasts.success(`Invite emailed to ${email}`);
      } catch (mailErr) {
        toasts.error(
          `Account created for ${email}, but the email didn't send (${reason(mailErr, 'mail error')}). Use Password link on their row to retry.`,
        );
      }
      showInvite = false;
      inviteEmail = '';
      inviteName = '';
      inviteRole = 'employee';
      await load();
    } catch (e) {
      toasts.error(reason(e, 'Could not send the invite'));
    } finally {
      inviting = false;
    }
  }

  function formatDate(d: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Team · Rolodex</title>
</svelte:head>

{#if $currentUser?.role !== 'admin'}
  <div class="flex items-center justify-center h-64 text-neutral-500 dark:text-neutral-400 text-sm">
    Access restricted to administrators.
  </div>
{:else}
  <div class="px-6 py-6 max-w-4xl mx-auto">
    <div class="flex items-end justify-between mb-6 flex-wrap gap-3">
      <div>
        <a href="{base}/admin" class="text-xs text-neutral-400 dark:text-neutral-500 hover:text-accent dark:hover:text-accent-dark">← Dashboard</a>
        <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight mt-1">Team</h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          {active} with access · {admins} {admins === 1 ? 'admin' : 'admins'}{members.length !== active ? ` · ${members.length - active} removed` : ''}
        </p>
      </div>
      <button on:click={() => (showInvite = !showInvite)} class="btn-primary text-sm">
        {showInvite ? 'Cancel' : 'Invite a teammate'}
      </button>
    </div>

    {#if showInvite}
      <div class="card p-4 mb-5">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-2">
            <label class="label" for="invite-email">Work email</label>
            <input id="invite-email" class="input" type="email" placeholder="name@fossunited.org" bind:value={inviteEmail} />
          </div>
          <div>
            <label class="label" for="invite-role">Role</label>
            <select id="invite-role" class="input" bind:value={inviteRole}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="invite-name">Name <span class="text-neutral-400">(optional)</span></label>
            <input id="invite-name" class="input" placeholder="Aarthi Menon" bind:value={inviteName} />
          </div>
        </div>
        <div class="flex items-center justify-between gap-3 mt-4">
          <p class="text-xs text-neutral-400 dark:text-neutral-500">
            They get an email with a link to set their own password. Nothing is shared with them until they do.
          </p>
          <button on:click={invite} disabled={inviting || !inviteEmail.trim()} class="btn-primary text-sm shrink-0">
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </div>
    {/if}

    {#if loading}
      <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
        {#each Array(4) as _}
          <div class="flex items-center gap-3 px-4 py-4 animate-pulse">
            <div class="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800"></div>
            <div class="flex-1 h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-1/3"></div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">
        {#each members as m (m.id)}
          <!-- The controls drop onto their own line on phones: sharing the row
               truncated names to "Karthik…" and clipped the "no access" chip,
               which is the one thing that must not be missed. -->
          <div class="px-3 sm:px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 {m.disabled ? 'opacity-60' : ''}">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <Avatar name={m.name || m.email} size="sm" />
              <div class="min-w-0">
                <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {m.name || m.email || 'Unnamed'}
                  {#if m.id === $currentUser?.id}
                    <span class="badge-neutral ml-1">you</span>
                  {/if}
                  {#if m.disabled}
                    <span class="badge-neutral ml-1">no access</span>
                  {/if}
                </p>
                <p class="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                  {m.email || 'joined'} {m.email ? '· joined' : ''} {formatDate(m.created)}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            {#if m.id === $currentUser?.id}
              <span class="badge-green shrink-0">{m.role === 'admin' ? 'Admin' : 'Employee'}</span>
            {:else}
              <select
                class="input py-1 text-xs w-28 shrink-0"
                value={m.role}
                disabled={busy === m.id}
                on:change={(ev) => onRoleChange(m, ev)}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
              <button
                on:click={() => sendPasswordEmail(m)}
                disabled={busy === m.id}
                class="btn-ghost text-xs shrink-0"
                title="Email them a link to set a new password"
              >
                Password link
              </button>
              {#if m.disabled}
                <button on:click={() => setAccess(m, false)} disabled={busy === m.id} class="btn-secondary text-xs py-1.5 shrink-0">Restore</button>
              {:else}
                <button
                  on:click={() => setAccess(m, true)}
                  disabled={busy === m.id}
                  class="btn-ghost text-xs py-1.5 shrink-0 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  Remove
                </button>
              {/if}
            {/if}
            </div>
          </div>
        {/each}
      </div>

      <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-4 leading-relaxed">
        Removing access keeps everything the person added, with their name on it — it is not a delete, and you can restore
        it. They can't sign in, and the app signs them out the next time it loads for them. You can't change your own role
        or access: ask another admin, which is also how an admin steps down.
      </p>
    {/if}
  </div>
{/if}
