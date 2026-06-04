<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { Contact } from '$lib/types';
  import { FU_ROLES, TOPICS, COUNTRIES } from '$lib/constants';
  import CityInput from '$lib/components/CityInput.svelte';
  import MultiSelect from '$lib/components/MultiSelect.svelte';

  $: id = $page.params.id ?? '';

  let name = '';
  let org = '';
  let designation = '';
  let city = '';
  let country = 'India';
  let email = '';
  let mobile = '';
  let secondary_email = '';
  let secondary_mobile = '';
  let how_you_know = '';
  let linkedin = '';
  let fu_roles: string[] = [];
  let fu_roles_other = '';
  let topics: string[] = [];
  let topics_other = '';

  let loading = true;
  let saving = false;
  let errors: Record<string, string> = {};

  onMount(async () => {
    try {
      const c = await pb.collection('contacts').getOne<Contact>(id);
      if ($currentUser?.role !== 'admin' && $currentUser?.id !== c.added_by) {
        toasts.error("You can't edit this contact");
        goto(`/contacts/${id}`);
        return;
      }
      name = c.name ?? '';
      org = c.org ?? '';
      designation = c.designation ?? '';
      city = c.city ?? '';
      country = c.country || 'India';
      email = c.email ?? '';
      mobile = c.mobile ?? '';
      secondary_email = c.secondary_email ?? '';
      secondary_mobile = c.secondary_mobile ?? '';
      how_you_know = c.how_you_know ?? '';
      linkedin = c.linkedin ?? '';
      fu_roles = c.fu_roles ?? [];
      fu_roles_other = c.fu_roles_other ?? '';
      topics_other = c.topics_other ?? '';
      topics = c.topics ?? [];
    } catch {
      toasts.error('Contact not found');
      goto('/contacts');
    } finally {
      loading = false;
    }
  });

  function validate() {
    errors = {};
    if (!name.trim() && !org.trim()) errors.identity = 'Either Name or Organisation is required.';
    if (!email.trim() && !mobile.trim()) errors.contact = 'Either Email or Mobile is required.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    return Object.keys(errors).length === 0;
  }

  async function save() {
    if (!validate()) return;
    saving = true;
    try {
      await pb.collection('contacts').update(id, {
        name: name.trim(),
        org: org.trim(),
        designation: designation.trim(),
        city: city.trim(),
        country,
        email: email.trim(),
        mobile: mobile.trim(),
        secondary_email: secondary_email.trim(),
        secondary_mobile: secondary_mobile.trim(),
        how_you_know: how_you_know.trim(),
        linkedin: linkedin.trim(),
        fu_roles_other: fu_roles.includes('other') ? fu_roles_other.trim() : '',
        topics_other: topics.includes('other') ? topics_other.trim() : '',
        fu_roles,
        topics,
      });
      toasts.success('Contact updated');
      goto(`/contacts/${id}`);
    } catch {
      toasts.error('Failed to update contact');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Edit Contact · Rolodex</title>
</svelte:head>

{#if loading}
  <div class="px-6 py-6 max-w-3xl mx-auto animate-pulse space-y-4">
    <div class="h-8 bg-neutral-100 dark:bg-neutral-800 rounded w-32"></div>
    <div class="card p-5 space-y-3">
      {#each Array(4) as _}
        <div class="h-10 bg-neutral-100 dark:bg-neutral-800 rounded"></div>
      {/each}
    </div>
  </div>
{:else}
  <div class="px-6 py-6 max-w-3xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <a href="/contacts/{id}" class="btn-ghost p-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </a>
      <div>
        <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">Edit Contact</h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{name || org || 'Contact'}</p>
      </div>
    </div>

    <div class="space-y-6">
      <div class="card p-5 space-y-4">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Identity</h2>
        {#if errors.identity}
          <p class="text-xs text-red-600 dark:text-red-400">{errors.identity}</p>
        {/if}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="name" class="label">Full Name</label>
            <input id="name" type="text" bind:value={name} class="input {errors.identity ? 'ring-2 ring-red-400' : ''}" placeholder="Ananya Sharma" />
          </div>
          <div>
            <label for="org" class="label">Organisation</label>
            <input id="org" type="text" bind:value={org} class="input {errors.identity ? 'ring-2 ring-red-400' : ''}" placeholder="GNOME Foundation" />
          </div>
          <div class="sm:col-span-2">
            <label for="designation" class="label">Designation <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
            <input id="designation" type="text" bind:value={designation} class="input" placeholder="Software Engineer" />
          </div>
        </div>
      </div>

      <div class="card p-5 space-y-4">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Contact Details</h2>
        {#if errors.contact}
          <p class="text-xs text-red-600 dark:text-red-400">{errors.contact}</p>
        {/if}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="email" class="label">Email</label>
            <input id="email" type="email" bind:value={email} class="input {errors.email || errors.contact ? 'ring-2 ring-red-400' : ''}" />
            {#if errors.email}<p class="text-xs text-red-500 mt-1">{errors.email}</p>{/if}
          </div>
          <div>
            <label for="mobile" class="label">Mobile / WhatsApp</label>
            <input id="mobile" type="tel" bind:value={mobile} class="input {errors.contact ? 'ring-2 ring-red-400' : ''}" />
          </div>
          <div>
            <label for="s-email" class="label">Secondary Email <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
            <input id="s-email" type="email" bind:value={secondary_email} class="input" />
          </div>
          <div>
            <label for="s-mobile" class="label">Secondary Mobile <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
            <input id="s-mobile" type="tel" bind:value={secondary_mobile} class="input" />
          </div>
          <div class="sm:col-span-2">
            <label for="linkedin" class="label">LinkedIn <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
            <input id="linkedin" type="url" bind:value={linkedin} class="input" placeholder="https://linkedin.com/in/username" />
          </div>
        </div>
      </div>

      <div class="card p-5 space-y-4">
        <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Location</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="city" class="label">City</label>
            <CityInput id="city" bind:value={city} />
          </div>
          <div>
            <label for="country" class="label">Country</label>
            <select id="country" bind:value={country} class="input">
              {#each COUNTRIES as c}
                <option value={c}>{c}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <div class="card p-5">
        <label for="how" class="label">How do you know them?</label>
        <textarea id="how" bind:value={how_you_know} class="input resize-none" rows="3"></textarea>
      </div>

      <div class="card p-5 space-y-3">
        <MultiSelect label="How can they be part of FOSS United?" options={FU_ROLES} bind:selected={fu_roles} />
        {#if fu_roles.includes('other')}
          <div class="animate-fade-in">
            <label for="fu-other" class="label">Specify other role</label>
            <input id="fu-other" type="text" bind:value={fu_roles_other} class="input" placeholder="e.g. Legal advisor, Accessibility advocate…" />
          </div>
        {/if}
      </div>

      <div class="card p-5 space-y-3">
        <MultiSelect label="Areas of Interest / Expertise" options={TOPICS} bind:selected={topics} columns={3} />
        {#if topics.includes('other')}
          <div class="animate-fade-in">
            <label for="topics-other" class="label">Specify other area</label>
            <input id="topics-other" type="text" bind:value={topics_other} class="input" placeholder="e.g. Quantum computing, Biotech…" />
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-3 pb-8">
        <a href="/contacts/{id}" class="btn-secondary">Cancel</a>
        <button on:click={save} disabled={saving} class="btn-primary">
          {#if saving}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Saving…
          {:else}
            Save Changes
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
