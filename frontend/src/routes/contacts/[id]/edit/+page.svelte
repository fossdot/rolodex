<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import type { Contact, ContactLogChange } from '$lib/types';
  import { FU_ROLES, TOPICS, COUNTRIES } from '$lib/constants';
  import CityInput from '$lib/components/CityInput.svelte';
  import OrgInput from '$lib/components/OrgInput.svelte';
  import MultiSelect from '$lib/components/MultiSelect.svelte';
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  import { sanitizeHtml, htmlToText } from '$lib/sanitizeHtml';

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

  let orgSuggestions: string[] = [];

  // Snapshot of the values as loaded, used to diff what changed on save.
  let original: Record<string, unknown> = {};

  let loading = true;
  let saving = false;
  let errors: Record<string, string> = {};

  onMount(async () => {
    try {
      const c = await pb.collection('contacts').getOne<Contact>(id);
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
      original = {
        name, org, designation, city, country, email, mobile,
        secondary_email, secondary_mobile, how_you_know, linkedin,
        fu_roles: [...fu_roles], fu_roles_other, topics: [...topics], topics_other,
      };
    } catch {
      toasts.error('Contact not found');
      goto('/contacts');
      return;
    } finally {
      loading = false;
    }

    try {
      const r = await pb.collection('contacts').getList(1, 500, {
        filter: "org != '' && deleted_at = null",
        fields: 'org',
      });
      orgSuggestions = [...new Set(r.items.map((i) => String(i.org).trim()).filter(Boolean))].sort();
    } catch {
      /* non-fatal */
    }
  });

  const roleLabel = (v: string) => FU_ROLES.find((r) => r.value === v)?.label ?? v;
  const topicLabel = (v: string) => TOPICS.find((t) => t.value === v)?.label ?? v;

  // Diff the current form values against the loaded snapshot, with friendly
  // labels, so the audit log records what actually changed.
  function computeChanges(): ContactLogChange[] {
    const out: ContactLogChange[] = [];
    const scalar = (field: string, a: unknown, b: string) => {
      const from = String(a ?? '').trim();
      const to = b.trim();
      if (from !== to) out.push({ field, from: from || '—', to: to || '—' });
    };
    scalar('Name', original.name, name);
    scalar('Organisation', original.org, org);
    scalar('Designation', original.designation, designation);
    scalar('City', original.city, city);
    scalar('Country', original.country, country);
    scalar('Email', original.email, email);
    scalar('Mobile', original.mobile, mobile);
    scalar('Secondary email', original.secondary_email, secondary_email);
    scalar('Secondary mobile', original.secondary_mobile, secondary_mobile);
    scalar('LinkedIn', original.linkedin, linkedin);

    // how_you_know is rich text — diff/show its plain-text form.
    const hykFrom = htmlToText(String(original.how_you_know ?? ''));
    const hykTo = htmlToText(how_you_know);
    if (hykFrom !== hykTo) out.push({ field: 'How you know them', from: hykFrom || '—', to: hykTo || '—' });

    const rolesFrom = [...((original.fu_roles as string[]) ?? [])].sort().map(roleLabel).join(', ');
    const rolesTo = [...fu_roles].sort().map(roleLabel).join(', ');
    if (rolesFrom !== rolesTo) out.push({ field: 'FOSS United roles', from: rolesFrom || '—', to: rolesTo || '—' });
    scalar('Other role', original.fu_roles_other, fu_roles.includes('other') ? fu_roles_other : '');

    const topicsFrom = [...((original.topics as string[]) ?? [])].sort().map(topicLabel).join(', ');
    const topicsTo = [...topics].sort().map(topicLabel).join(', ');
    if (topicsFrom !== topicsTo) out.push({ field: 'Topics', from: topicsFrom || '—', to: topicsTo || '—' });
    scalar('Other topic', original.topics_other, topics.includes('other') ? topics_other : '');

    return out;
  }

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
    saving = true;
    try {
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

      await pb.collection('contacts').update(id, fd);

      // Record what changed (editor is forced server-side). Best-effort —
      // a logging failure must not block the save.
      const changes = computeChanges();
      if (changes.length) {
        try {
          await pb.collection('contact_logs').create({ contact: id, changes });
        } catch {
          /* non-fatal */
        }
      }

      toasts.success('Contact updated');
      goto(`/contacts/${id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { message?: string } })?.response?.message;
      toasts.error(msg || 'Failed to update contact');
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
            <OrgInput id="org" bind:value={org} suggestions={orgSuggestions} extraClass={errors.identity ? 'ring-2 ring-red-400' : ''} />
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
        <label for="how" class="label">How do you know them? *</label>
        <RichTextEditor id="how" bind:value={how_you_know} invalid={!!errors.how_you_know} />
        {#if errors.how_you_know}<p class="text-xs text-red-500 mt-1">{errors.how_you_know}</p>{/if}
      </div>

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
