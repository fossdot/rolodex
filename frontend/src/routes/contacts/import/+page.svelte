<script lang="ts">
  import { goto } from '$app/navigation';
  import { pb } from '$lib/pb';
  import { currentUser, toasts } from '$lib/stores';
  import { FU_ROLES, TOPICS, normalizeCity } from '$lib/constants';
  import { parseCsvObjects, toCsv } from '$lib/csv';

  // CSV column order for both the template and parsing. Header names match the
  // contact fields exactly so the file is self-documenting.
  const COLUMNS = [
    'name', 'org', 'designation', 'city', 'country',
    'email', 'mobile', 'secondary_email', 'secondary_mobile', 'linkedin',
    'how_you_know', 'fu_roles', 'fu_roles_other', 'topics', 'topics_other',
  ];

  const roleLabel = (v: string) => FU_ROLES.find((r) => r.value === v)?.label ?? v;
  const topicLabel = (v: string) => TOPICS.find((t) => t.value === v)?.label ?? v;

  // Match a single token against an option list by slug OR label (case-insensitive).
  function mapTokens(raw: string, options: { value: string; label: string }[]) {
    const tokens = raw.split('|').map((t) => t.trim()).filter(Boolean);
    const values: string[] = [];
    const unknown: string[] = [];
    for (const t of tokens) {
      const lc = t.toLowerCase();
      const match = options.find((o) => o.value.toLowerCase() === lc || o.label.toLowerCase() === lc);
      if (match) {
        if (!values.includes(match.value)) values.push(match.value);
      } else {
        unknown.push(t);
      }
    }
    return { values, unknown };
  }

  // ── Template download (≤3 of the user's OWN contacts as samples) ────────────
  let downloading = false;
  async function downloadTemplate() {
    downloading = true;
    try {
      let rows: string[][] = [];
      try {
        const r = await pb.collection('contacts').getList(1, 3, {
          filter: `added_by = '${$currentUser?.id}' && deleted_at = null`,
          sort: '-created',
        });
        rows = r.items.map((c) => [
          c.name ?? '', c.org ?? '', c.designation ?? '', c.city ?? '', c.country ?? '',
          c.email ?? '', c.mobile ?? '', c.secondary_email ?? '', c.secondary_mobile ?? '', c.linkedin ?? '',
          c.how_you_know ?? '',
          (c.fu_roles ?? []).map(roleLabel).join(' | '), c.fu_roles_other ?? '',
          (c.topics ?? []).map(topicLabel).join(' | '), c.topics_other ?? '',
        ]);
      } catch {
        /* fall through to synthetic examples */
      }

      // No own contacts yet → ship illustrative examples instead.
      if (rows.length === 0) {
        rows = [
          ['Ananya Sharma', 'Red Hat', 'Principal Engineer', 'Bangalore', 'India',
            'ananya@example.com', '+91 98765 43210', '', '', 'https://linkedin.com/in/ananya',
            'Met at IndiaFOSS 2024', 'Speaker | Mentor', '', 'Open Source | DevOps / Infrastructure', ''],
          ['Rahul Verma', 'Postman', 'Developer Advocate', 'Delhi', 'India',
            '', '+91 91234 56780', '', '', '',
            'Connected at a Delhi meetup', 'Meetup Host', '', 'Community Building', ''],
        ];
      }

      const csv = toCsv(COLUMNS, rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rolodex-contacts-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      downloading = false;
    }
  }

  // ── File parsing + validation ───────────────────────────────────────────────
  type ParsedRow = {
    line: number;
    payload: Record<string, unknown>;
    display: { name: string; org: string; contact: string };
    errors: string[];
  };

  let fileName = '';
  let parsed: ParsedRow[] = [];
  let parseError = '';
  let dragging = false;

  $: validRows = parsed.filter((r) => r.errors.length === 0);
  $: invalidRows = parsed.filter((r) => r.errors.length > 0);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateRow(o: Record<string, string>, line: number): ParsedRow {
    const errors: string[] = [];
    const name = (o.name ?? '').trim();
    const org = (o.org ?? '').trim();
    const email = (o.email ?? '').trim();
    const secondary_email = (o.secondary_email ?? '').trim();
    const mobile = (o.mobile ?? '').trim();
    const how_you_know = (o.how_you_know ?? '').trim();

    if (!name && !org) errors.push('Name or Organisation is required');
    if (!email && !mobile) errors.push('Email or Mobile is required');
    if (email && !EMAIL_RE.test(email)) errors.push('Invalid email');
    if (secondary_email && !EMAIL_RE.test(secondary_email)) errors.push('Invalid secondary email');
    if (!how_you_know) errors.push('"how_you_know" is required');

    const { values: fu_roles, unknown: badRoles } = mapTokens(o.fu_roles ?? '', FU_ROLES);
    if (badRoles.length) errors.push(`Unknown role(s): ${badRoles.join(', ')}`);
    if (!fu_roles.length) errors.push('At least one fu_roles value is required');

    const { values: topics, unknown: badTopics } = mapTokens(o.topics ?? '', TOPICS);
    if (badTopics.length) errors.push(`Unknown topic(s): ${badTopics.join(', ')}`);
    if (!topics.length) errors.push('At least one topics value is required');

    const fu_roles_other = (o.fu_roles_other ?? '').trim();
    const topics_other = (o.topics_other ?? '').trim();
    if (fu_roles.includes('other') && !fu_roles_other) errors.push('fu_roles_other is required when "other" is used');
    if (topics.includes('other') && !topics_other) errors.push('topics_other is required when "other" is used');

    return {
      line,
      errors,
      display: { name, org, contact: email || mobile },
      payload: {
        name, org,
        designation: (o.designation ?? '').trim(),
        city: normalizeCity(o.city ?? ''),
        country: (o.country ?? '').trim() || 'India',
        email, mobile,
        secondary_email,
        secondary_mobile: (o.secondary_mobile ?? '').trim(),
        how_you_know,
        linkedin: (o.linkedin ?? '').trim(),
        fu_roles,
        topics,
        fu_roles_other: fu_roles.includes('other') ? fu_roles_other : '',
        topics_other: topics.includes('other') ? topics_other : '',
        added_by: $currentUser?.id ?? '',
      },
    };
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    resetResults();
    fileName = file.name;
    parsed = [];
    parseError = '';
    try {
      const text = await file.text();
      const objects = parseCsvObjects(text);
      if (objects.length === 0) {
        parseError = 'The file has no data rows.';
        return;
      }
      const known = new Set(COLUMNS);
      const hasKnownHeader = Object.keys(objects[0]).some((h) => known.has(h));
      if (!hasKnownHeader) {
        parseError = 'No recognised columns found. Download the template to see the expected header row.';
        return;
      }
      // +2: row 1 is the header, and arrays are 0-indexed.
      parsed = objects.map((o, i) => validateRow(o, i + 2));
    } catch {
      parseError = 'Could not read that file. Make sure it is a valid .csv.';
    }
  }

  function onInputChange(e: Event) {
    handleFile((e.target as HTMLInputElement).files?.[0]);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    handleFile(e.dataTransfer?.files?.[0]);
  }

  // ── Import ────────────────────────────────────────────────────────────────
  let importing = false;
  let importedCount = 0;
  let failures: { line: number; message: string }[] = [];
  let done = false;

  function resetResults() {
    done = false;
    importedCount = 0;
    failures = [];
  }

  async function runImport() {
    if (!validRows.length || importing) return;
    importing = true;
    resetResults();
    for (const row of validRows) {
      try {
        await pb.collection('contacts').create(row.payload);
        importedCount += 1;
      } catch (e: unknown) {
        const msg = (e as { response?: { message?: string } })?.response?.message;
        failures = [...failures, { line: row.line, message: msg || 'Server rejected this row' }];
      }
    }
    importing = false;
    done = true;
    if (importedCount > 0) toasts.success(`Imported ${importedCount} contact${importedCount === 1 ? '' : 's'}`);
    if (failures.length) toasts.error(`${failures.length} row${failures.length === 1 ? '' : 's'} failed to import`);
  }

  function clearFile() {
    fileName = '';
    parsed = [];
    parseError = '';
    resetResults();
  }
</script>

<svelte:head>
  <title>Import Contacts · Rolodex</title>
</svelte:head>

<div class="px-6 py-6 max-w-3xl mx-auto">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-6">
    <a href="/contacts" class="btn-ghost p-2" aria-label="Back to contacts">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </a>
    <div>
      <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">Import Contacts</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Bulk-add contacts from a CSV file</p>
    </div>
  </div>

  <div class="space-y-6">
    <!-- Step 1: template -->
    <div class="card p-5 space-y-3">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">1. Download the template</h2>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Includes the required header row and up to three of your existing contacts as a guide.
          </p>
        </div>
        <button on:click={downloadTemplate} disabled={downloading} class="btn-secondary shrink-0 gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          {downloading ? 'Preparing…' : 'Download template'}
        </button>
      </div>
      <div class="text-xs text-neutral-500 dark:text-neutral-400 space-y-1 border-t border-neutral-100 dark:border-neutral-800 pt-3">
        <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Required per row:</span> a Name <em>or</em> Organisation, an Email <em>or</em> Mobile, <code>how_you_know</code>, at least one <code>fu_roles</code> and one <code>topics</code> value.</p>
        <p><span class="font-medium text-neutral-700 dark:text-neutral-300">Multiple values:</span> separate roles/topics with a pipe, e.g. <code>Speaker | Mentor</code>. Use either the label or its code. If you use <code>Other</code>, fill the matching <code>*_other</code> column.</p>
      </div>

      <details class="text-xs">
        <summary class="cursor-pointer text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 select-none">Allowed roles &amp; topics</summary>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div>
            <p class="font-medium text-neutral-700 dark:text-neutral-300 mb-1">fu_roles</p>
            <div class="flex flex-wrap gap-1">
              {#each FU_ROLES as r}<span class="badge-neutral">{r.label}</span>{/each}
            </div>
          </div>
          <div>
            <p class="font-medium text-neutral-700 dark:text-neutral-300 mb-1">topics</p>
            <div class="flex flex-wrap gap-1">
              {#each TOPICS as t}<span class="badge-neutral">{t.label}</span>{/each}
            </div>
          </div>
        </div>
      </details>
    </div>

    <!-- Step 2: upload -->
    <div class="card p-5 space-y-4">
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">2. Upload your file</h2>

      {#if !fileName}
        <label
          class="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-10 px-4 cursor-pointer transition-colors
            {dragging ? 'border-accent dark:border-accent-dark bg-accent/5' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'}"
          on:dragover|preventDefault={() => (dragging = true)}
          on:dragleave={() => (dragging = false)}
          on:drop={onDrop}
        >
          <svg class="text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          <span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Drop a CSV here, or click to choose</span>
          <span class="text-xs text-neutral-400">.csv files only</span>
          <input type="file" accept=".csv,text/csv" on:change={onInputChange} class="hidden" />
        </label>
      {:else}
        <div class="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <svg class="text-accent dark:text-accent-dark shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            <span class="text-sm text-neutral-700 dark:text-neutral-200 truncate">{fileName}</span>
          </div>
          <button on:click={clearFile} class="btn-ghost text-xs py-1 text-red-500 shrink-0">Remove</button>
        </div>
      {/if}

      {#if parseError}
        <p class="text-sm text-red-600 dark:text-red-400">{parseError}</p>
      {/if}

      {#if parsed.length}
        <div class="flex items-center gap-3 text-sm">
          <span class="badge-green">{validRows.length} ready</span>
          {#if invalidRows.length}<span class="badge bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">{invalidRows.length} with errors</span>{/if}
        </div>

        <!-- Preview -->
        <div class="max-h-80 overflow-auto rounded-lg border border-neutral-100 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800">
          {#each parsed as row (row.line)}
            <div class="px-3 py-2 text-sm flex items-start gap-2 {row.errors.length ? 'bg-red-50/60 dark:bg-red-950/30' : ''}">
              <span class="text-[11px] text-neutral-400 w-8 shrink-0 pt-0.5">#{row.line}</span>
              <div class="min-w-0 flex-1">
                <p class="text-neutral-800 dark:text-neutral-100 truncate">
                  {row.display.name || row.display.org || '—'}
                  {#if row.display.org && row.display.name}<span class="text-neutral-400"> · {row.display.org}</span>{/if}
                </p>
                {#if row.errors.length}
                  <p class="text-xs text-red-600 dark:text-red-400 mt-0.5">{row.errors.join(' · ')}</p>
                {:else}
                  <p class="text-xs text-neutral-400 truncate">{row.display.contact}</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        {#if invalidRows.length}
          <p class="text-xs text-neutral-500 dark:text-neutral-400">Rows with errors are skipped. Fix them in your file and re-upload to include them.</p>
        {/if}
      {/if}
    </div>

    <!-- Results -->
    {#if done}
      <div class="card p-5 space-y-2">
        <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Imported {importedCount} of {validRows.length} contact{validRows.length === 1 ? '' : 's'}.
        </p>
        {#if failures.length}
          <div class="text-xs text-red-600 dark:text-red-400 space-y-0.5">
            {#each failures as f}<p>Row #{f.line}: {f.message}</p>{/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pb-8">
      <a href="/contacts" class="btn-secondary">{done ? 'Done' : 'Cancel'}</a>
      <button on:click={runImport} disabled={importing || !validRows.length} class="btn-primary">
        {#if importing}
          <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          Importing {importedCount}/{validRows.length}…
        {:else}
          Import {validRows.length || ''} contact{validRows.length === 1 ? '' : 's'}
        {/if}
      </button>
    </div>
  </div>
</div>
