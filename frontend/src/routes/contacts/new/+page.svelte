<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import { FU_ROLES, TOPICS, COUNTRIES } from '$lib/constants';
  import CityInput from '$lib/components/CityInput.svelte';
  import OrgInput from '$lib/components/OrgInput.svelte';
  import MultiSelect from '$lib/components/MultiSelect.svelte';
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  import { sanitizeHtml, htmlToText } from '$lib/sanitizeHtml';

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

  // Org autocomplete: suggest spellings already in the database
  let orgSuggestions: string[] = [];
  onMount(async () => {
    try {
      const r = await pb.collection('contacts').getList(1, 500, {
        filter: "org != '' && deleted_at = null",
        fields: 'org',
      });
      orgSuggestions = [...new Set(r.items.map((i) => String(i.org).trim()).filter(Boolean))].sort();
    } catch {
      /* non-fatal — autocomplete just stays empty */
    }
  });

  let loading = false;
  let errors: Record<string, string> = {};

  function validate() {
    errors = {};
    if (!name.trim() && !org.trim()) errors.identity = 'Either Name or Organisation is required.';
    if (!email.trim() && !mobile.trim()) errors.contact = 'Either Email or Mobile is required.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (!htmlToText(how_you_know).trim()) errors.how_you_know = 'Tell us how you know them.';
    if (fu_roles.length === 0) errors.fu_roles = 'Select at least one way they can be part of FOSS United.';
    if (topics.length === 0) errors.topics = 'Select at least one area of interest.';
    if (fu_roles.includes('other') && !fu_roles_other.trim()) errors.fu_roles_other = 'Please specify the other role.';
    if (topics.includes('other') && !topics_other.trim()) errors.topics_other = 'Please specify the other area.';
    return Object.keys(errors).length === 0;
  }

  async function save() {
    if (!validate()) return;
    loading = true;
    try {
      // FormData so the photo file and the multi-select arrays travel together
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('org', org.trim());
      fd.append('designation', designation.trim());
      fd.append('city', city.trim());
      fd.append('country', country);
      fd.append('email', email.trim());
      fd.append('mobile', mobile.trim());
      fd.append('secondary_email', secondary_email.trim());
      fd.append('secondary_mobile', secondary_mobile.trim());
      fd.append('how_you_know', sanitizeHtml(how_you_know));
      fd.append('linkedin', linkedin.trim());
      fu_roles.forEach((r) => fd.append('fu_roles', r));
      topics.forEach((t) => fd.append('topics', t));
      fd.append('fu_roles_other', fu_roles.includes('other') ? fu_roles_other.trim() : '');
      fd.append('topics_other', topics.includes('other') ? topics_other.trim() : '');
      fd.append('added_by', $currentUser?.id ?? '');

      await pb.collection('contacts').create(fd);
      toasts.success('Contact added successfully');
      goto(`${base}/contacts`);
    } catch (e: unknown) {
      const msg = (e as { response?: { message?: string } })?.response?.message;
      toasts.error(msg || 'Failed to save contact. Please try again.');
    } finally {
      loading = false;
    }
  }

  // Cmd/Ctrl+S saves from anywhere on the form (overrides the browser's save-page).
  function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!loading) save();
    }
  }
</script>

<svelte:head>
  <title>Add Contact · Rolodex</title>
</svelte:head>

<svelte:window on:keydown={onKeydown} />

<div class="px-6 py-6 max-w-3xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between gap-3 mb-6">
    <div class="flex items-center gap-3 min-w-0">
      <a href="{base}/contacts" class="btn-ghost p-2 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </a>
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">Add Contact</h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Add someone from your network</p>
      </div>
    </div>
    <!-- Top-right save for laptop view; the bottom button stays for narrow screens -->
    <button on:click={save} disabled={loading} class="btn-primary hidden sm:inline-flex shrink-0">
      {loading ? 'Saving…' : 'Save Contact'}
    </button>
  </div>

  <div class="space-y-6">
    <!-- Identity -->
    <div class="card p-5 space-y-4">
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Identity</h2>
      {#if errors.identity}
        <p class="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          {errors.identity}
        </p>
      {/if}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="name" class="label">Full Name</label>
          <input id="name" type="text" bind:value={name} class="input {errors.identity ? 'ring-2 ring-red-400' : ''}" placeholder="Ananya Sharma" />
        </div>
        <div>
          <label for="org" class="label">Organisation</label>
          <OrgInput id="org" bind:value={org} suggestions={orgSuggestions} extraClass={errors.identity ? 'ring-2 ring-red-400' : ''} />
        </div>
        <div class="sm:col-span-2">
          <label for="designation" class="label">Designation <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
          <input id="designation" type="text" bind:value={designation} class="input" placeholder="Software Engineer" />
        </div>
      </div>
    </div>

    <!-- Contact details -->
    <div class="card p-5 space-y-4">
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Contact Details</h2>
      {#if errors.contact}
        <p class="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          {errors.contact}
        </p>
      {/if}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="email" class="label">Email</label>
          <input id="email" type="email" bind:value={email} class="input {errors.email || errors.contact ? 'ring-2 ring-red-400' : ''}" placeholder="ananya@example.com" />
          {#if errors.email}
            <p class="text-xs text-red-500 mt-1">{errors.email}</p>
          {/if}
        </div>
        <div>
          <label for="mobile" class="label">Mobile / WhatsApp</label>
          <input id="mobile" type="tel" bind:value={mobile} class="input {errors.contact ? 'ring-2 ring-red-400' : ''}" placeholder="+91 98765 43210" />
        </div>
        <div>
          <label for="secondary-email" class="label">Secondary Email <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
          <input id="secondary-email" type="email" bind:value={secondary_email} class="input" placeholder="work@example.com" />
        </div>
        <div>
          <label for="secondary-mobile" class="label">Secondary Mobile <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
          <input id="secondary-mobile" type="tel" bind:value={secondary_mobile} class="input" placeholder="+91 87654 32109" />
        </div>
        <div class="sm:col-span-2">
          <label for="linkedin" class="label">LinkedIn <span class="text-neutral-400 normal-case font-normal">(optional)</span></label>
          <input id="linkedin" type="url" bind:value={linkedin} class="input" placeholder="https://linkedin.com/in/username" />
        </div>
      </div>
    </div>

    <!-- Location -->
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

    <!-- Context -->
    <div class="card p-5 space-y-4">
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Context</h2>
      <div>
        <label for="how-you-know" class="label">How do you know them? *</label>
        <RichTextEditor id="how-you-know" bind:value={how_you_know} invalid={!!errors.how_you_know} placeholder="Met at IndiaFOSS 2024, connected through Mozilla community…" />
        {#if errors.how_you_know}<p class="text-xs text-red-500 mt-1">{errors.how_you_know}</p>{/if}
      </div>
    </div>

    <!-- FU Roles -->
    <div class="card p-5 space-y-3 {errors.fu_roles ? 'ring-2 ring-red-400' : ''}">
      <MultiSelect label="How can they be part of FOSS United? *" options={FU_ROLES} bind:selected={fu_roles} />
      {#if errors.fu_roles}<p class="text-xs text-red-500">{errors.fu_roles}</p>{/if}
      {#if fu_roles.includes('other')}
        <div class="animate-fade-in">
          <label for="fu-other" class="label">Specify other role *</label>
          <input id="fu-other" type="text" bind:value={fu_roles_other} class="input {errors.fu_roles_other ? 'ring-2 ring-red-400' : ''}" placeholder="e.g. Legal advisor, Accessibility advocate…" />
          {#if errors.fu_roles_other}<p class="text-xs text-red-500 mt-1">{errors.fu_roles_other}</p>{/if}
        </div>
      {/if}
    </div>

    <!-- Topics -->
    <div class="card p-5 space-y-3 {errors.topics ? 'ring-2 ring-red-400' : ''}">
      <MultiSelect label="Areas of Interest / Expertise *" options={TOPICS} bind:selected={topics} columns={3} />
      {#if errors.topics}<p class="text-xs text-red-500">{errors.topics}</p>{/if}
      {#if topics.includes('other')}
        <div class="animate-fade-in">
          <label for="topics-other" class="label">Specify other area *</label>
          <input id="topics-other" type="text" bind:value={topics_other} class="input {errors.topics_other ? 'ring-2 ring-red-400' : ''}" placeholder="e.g. Quantum computing, Biotech…" />
          {#if errors.topics_other}<p class="text-xs text-red-500 mt-1">{errors.topics_other}</p>{/if}
        </div>
      {/if}
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pb-8">
      <a href="{base}/contacts" class="btn-secondary">Cancel</a>
      <button on:click={save} disabled={loading} class="btn-primary">
        {#if loading}
          <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          Saving…
        {:else}
          Save Contact
        {/if}
      </button>
    </div>
  </div>
</div>
