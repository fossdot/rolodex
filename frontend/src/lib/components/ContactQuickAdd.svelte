<script lang="ts">
  /**
   * Compact "create a contact without leaving the page" dialog, used by the
   * activity-logging flow (issue #6) when someone who attended isn't in the
   * Rolodex yet.
   *
   * It asks for exactly what the server requires and nothing more — the full
   * form at /contacts/new stays the place to fill in the rest. Everything here
   * mirrors the validation in that form so a save can't bounce.
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import { FU_ROLES, TOPICS, COUNTRIES, normalizeCity } from '$lib/constants';
  import { loadOrganisations, resolveOrgs } from '$lib/org';
  import type { Contact, Organisation } from '$lib/types';
  import CityInput from './CityInput.svelte';
  import OrgsInput from './OrgsInput.svelte';
  import MultiSelect from './MultiSelect.svelte';
  import RichTextEditor from './RichTextEditor.svelte';
  import { sanitizeHtml, htmlToText } from '$lib/sanitizeHtml';

  export let open = false;
  /** Pre-fills the name field from whatever was typed in the contact search. */
  export let initialName = '';

  const dispatch = createEventDispatcher<{ created: Contact; cancel: void }>();

  let name = '';
  let orgs: string[] = [];
  let orgDesignations: Record<string, string> = {};
  let designation = '';
  let city = '';
  let country = 'India';
  let email = '';
  let mobile = '';
  let how_you_know = '';
  let fu_roles: string[] = [];
  let fu_roles_other = '';
  let topics: string[] = [];
  let topics_other = '';

  let knownOrgs: Organisation[] = [];
  $: orgSuggestions = knownOrgs.map((o) => o.name);

  let saving = false;
  let errors: Record<string, string> = {};

  // `open` going true re-seeds the form, so each opening starts clean rather
  // than inheriting whatever the last attempt left behind.
  let wasOpen = false;
  $: if (open && !wasOpen) {
    wasOpen = true;
    name = initialName;
    orgs = [];
    orgDesignations = {};
    designation = '';
    city = '';
    country = 'India';
    email = '';
    mobile = '';
    how_you_know = '';
    fu_roles = [];
    fu_roles_other = '';
    topics = [];
    topics_other = '';
    errors = {};
  } else if (!open && wasOpen) {
    wasOpen = false;
  }

  onMount(async () => {
    try {
      knownOrgs = await loadOrganisations();
    } catch {
      /* non-fatal — autocomplete stays empty */
    }
  });

  function validate() {
    errors = {};
    if (!name.trim() && orgs.length === 0) errors.identity = 'Either Name or Organisation is required.';
    if (!email.trim() && !mobile.trim()) errors.contact = 'Either Email or Mobile is required.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (!htmlToText(how_you_know).trim()) errors.how_you_know = 'Tell us how you know them.';
    if (fu_roles.length === 0) errors.fu_roles = 'Select at least one role.';
    if (topics.length === 0) errors.topics = 'Select at least one area of interest.';
    if (fu_roles.includes('other') && !fu_roles_other.trim()) errors.fu_roles_other = 'Please specify the other role.';
    if (topics.includes('other') && !topics_other.trim()) errors.topics_other = 'Please specify the other area.';
    return Object.keys(errors).length === 0;
  }

  async function save() {
    if (!validate() || saving) return;
    saving = true;
    try {
      const { ids: orgIds, idByLowerName } = await resolveOrgs(orgs, knownOrgs);
      const designationsById: Record<string, string> = {};
      for (const [name, text] of Object.entries(orgDesignations)) {
        const oid = idByLowerName.get(name.trim().toLowerCase());
        if (oid && text.trim()) designationsById[oid] = text.trim();
      }
      const created = await pb.collection('contacts').create<Contact>({
        name: name.trim(),
        orgs: orgIds,
        org_designations: designationsById,
        designation: designation.trim(),
        city: normalizeCity(city),
        country,
        email: email.trim(),
        mobile: mobile.trim(),
        secondary_email: '',
        secondary_mobile: '',
        how_you_know: sanitizeHtml(how_you_know),
        linkedin: '',
        fu_roles,
        topics,
        fu_roles_other: fu_roles.includes('other') ? fu_roles_other.trim() : '',
        topics_other: topics.includes('other') ? topics_other.trim() : '',
        added_by: $currentUser?.id ?? '',
      });
      // Re-read expanded so the caller can show the organisation straight away.
      const full = await pb.collection('contacts').getOne<Contact>(created.id, { expand: 'orgs' });
      toasts.success('Contact added');
      dispatch('created', full);
      open = false;
    } catch (e: unknown) {
      const msg = (e as { response?: { message?: string } })?.response?.message;
      toasts.error(msg || 'Failed to add contact. Please try again.');
    } finally {
      saving = false;
    }
  }

  function cancel() {
    open = false;
    dispatch('cancel');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) cancel();
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4 sm:p-8 animate-fade-in"
    role="presentation"
    on:click|self={cancel}
  >
    <div class="card w-full max-w-2xl p-5 space-y-4 my-auto" role="dialog" aria-modal="true" aria-label="Add a contact">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-50">Add a contact</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Just the essentials — you can fill in the rest on their profile later.
          </p>
        </div>
        <button on:click={cancel} class="btn-ghost p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {#if errors.identity}<p class="text-xs text-red-500">{errors.identity}</p>{/if}

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="qa-name" class="label">Name</label>
          <input id="qa-name" type="text" bind:value={name} class="input {errors.identity ? 'ring-2 ring-red-400' : ''}" placeholder="Ananya Sharma" />
        </div>
        <div>
          <label for="qa-designation" class="label">Designation</label>
          <input id="qa-designation" type="text" bind:value={designation} class="input" placeholder="Professor, CSE" />
        </div>
        <div class="sm:col-span-2">
          <label for="qa-org" class="label">Organisation</label>
          <OrgsInput id="qa-org" bind:value={orgs} bind:designations={orgDesignations} suggestions={orgSuggestions} extraClass={errors.identity ? 'ring-2 ring-red-400' : ''} />
        </div>

        <div class="sm:col-span-2">
          {#if errors.contact}<p class="text-xs text-red-500 mb-1.5">{errors.contact}</p>{/if}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="qa-email" class="label">Email</label>
              <input id="qa-email" type="email" bind:value={email} class="input {errors.email || errors.contact ? 'ring-2 ring-red-400' : ''}" placeholder="name@example.org" />
              {#if errors.email}<p class="text-xs text-red-500 mt-1">{errors.email}</p>{/if}
            </div>
            <div>
              <label for="qa-mobile" class="label">Mobile</label>
              <input id="qa-mobile" type="tel" bind:value={mobile} class="input {errors.contact ? 'ring-2 ring-red-400' : ''}" placeholder="+91 98200 11111" />
            </div>
          </div>
        </div>

        <div>
          <label for="qa-city" class="label">City</label>
          <CityInput id="qa-city" bind:value={city} />
        </div>
        <div>
          <label for="qa-country" class="label">Country</label>
          <select id="qa-country" bind:value={country} class="input">
            {#each COUNTRIES as c}<option value={c}>{c}</option>{/each}
          </select>
        </div>

        <div class="sm:col-span-2">
          <label for="qa-how" class="label">How you know them *</label>
          <RichTextEditor id="qa-how" bind:value={how_you_know} invalid={!!errors.how_you_know} placeholder="Met at IndiaFOSS 2026…" />
          {#if errors.how_you_know}<p class="text-xs text-red-500 mt-1">{errors.how_you_know}</p>{/if}
        </div>

        <div class="sm:col-span-2">
          <MultiSelect options={FU_ROLES} bind:selected={fu_roles} label="FOSS United Roles *" columns={3} />
          {#if errors.fu_roles}<p class="text-xs text-red-500 mt-1">{errors.fu_roles}</p>{/if}
          {#if fu_roles.includes('other')}
            <input type="text" bind:value={fu_roles_other} class="input mt-2 {errors.fu_roles_other ? 'ring-2 ring-red-400' : ''}" placeholder="Describe the other role" />
            {#if errors.fu_roles_other}<p class="text-xs text-red-500 mt-1">{errors.fu_roles_other}</p>{/if}
          {/if}
        </div>

        <div class="sm:col-span-2">
          <MultiSelect options={TOPICS} bind:selected={topics} label="Topics *" columns={3} />
          {#if errors.topics}<p class="text-xs text-red-500 mt-1">{errors.topics}</p>{/if}
          {#if topics.includes('other')}
            <input type="text" bind:value={topics_other} class="input mt-2 {errors.topics_other ? 'ring-2 ring-red-400' : ''}" placeholder="Describe the other topic" />
            {#if errors.topics_other}<p class="text-xs text-red-500 mt-1">{errors.topics_other}</p>{/if}
          {/if}
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <button on:click={cancel} class="btn-secondary text-sm py-1.5">Cancel</button>
        <button on:click={save} disabled={saving} class="btn-primary text-sm py-1.5">
          {#if saving}
            <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Adding…
          {:else}
            Add Contact
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
