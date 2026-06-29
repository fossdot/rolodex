<script lang="ts">
  import { base } from '$app/paths';
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

  // ── Fuzzy "did you mean?" helper ─────────────────────────────────────────────
  // Powers suggestions for misspelled headers and role/topic values.
  function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prevRow = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const row = [i];
      for (let j = 1; j <= n; j++) {
        row[j] = a[i - 1] === b[j - 1]
          ? prevRow[j - 1]
          : 1 + Math.min(prevRow[j - 1], prevRow[j], row[j - 1]);
      }
      prevRow = row;
    }
    return prevRow[n];
  }

  // Closest candidate within a sensible edit distance, else null (no guess).
  function closest(input: string, candidates: string[]): string | null {
    const lc = input.toLowerCase();
    let best: string | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      const d = levenshtein(lc, c.toLowerCase());
      if (d < bestD) { bestD = d; best = c; }
    }
    return best && bestD <= Math.max(2, Math.ceil(best.length * 0.4)) ? best : null;
  }

  // Suggest the closest role/topic label for an unknown token (matches label or code).
  function suggestOption(input: string, options: { value: string; label: string }[]): string | null {
    const lc = input.toLowerCase();
    let best: string | null = null;
    let bestD = Infinity;
    for (const o of options) {
      for (const cand of [o.label, o.value]) {
        const d = levenshtein(lc, cand.toLowerCase());
        if (d < bestD) { bestD = d; best = o.label; }
      }
    }
    return best && bestD <= Math.max(2, Math.ceil(best.length * 0.4)) ? best : null;
  }

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

  // ── Template download ────────────────────────────────────────────────────────
  // Three curated example rows that demonstrate every formatting rule: a fully
  // filled contact with pipe-separated multi-values, a minimal required-only
  // contact, and one that uses "Other" with the matching *_other columns.
  function downloadTemplate() {
    // Fictional sample rows — Rolodex never exports real contacts. Between them
    // these rows use every allowed role and topic, several countries/cities, the
    // optional columns left blank or filled, pipe-separated multi-values, and the
    // "Other" + matching *_other pattern. Employees overwrite them with real data.
    const examples: string[][] = [
      ['Ananya Sharma', 'Red Hat', 'Principal Engineer', 'Bangalore', 'India',
        'ananya@example.com', '+91 98765 43210', '', '', 'https://linkedin.com/in/ananya',
        'Met at IndiaFOSS 2024', 'Speaker | Mentor', '', 'Technologist | Open Source | DevOps / Infrastructure', ''],
      ['', 'Postman', 'Developer Advocate', 'Delhi', 'India',
        '', '+91 91234 56780', '', '', '',
        'Connected at a Delhi meetup', 'Meetup Host', '', 'Community Building', ''],
      ['Rahul Verma', 'Zerodha', 'Engineering Manager', 'Mumbai', 'India',
        'rahul@example.com', '', '', '', 'https://linkedin.com/in/rahulverma',
        'Sponsored our annual conference', 'Sponsor', '', 'Finance / Funding | Open Source', ''],
      ['Meera Iyer', 'NIT Tiruchirappalli', 'Student', 'Tiruchirappalli', 'India',
        'meera@example.com', '+91 90000 11111', '', '', '',
        'Runs the campus FOSS club', 'FOSS Club Ambassador (Student)', '', 'Education | AI / ML', ''],
      ['Daniel Brooks', 'HashiCorp', 'Open Source Lead', 'San Francisco', 'United States',
        'daniel@example.com', '+1 415 555 0142', '', '', 'https://linkedin.com/in/danielbrooks',
        'Maintains a project we rely on', 'Project Maintainer | Mentor', '', 'Open Source | Security', ''],
      ['Lakshmi Rao', '', 'Policy Researcher', 'Delhi NCR', 'India',
        'lakshmi@example.com', '', 'lakshmi.alt@example.com', '', '',
        'Advises our public-policy work', 'Governing Board (Expert)', '', 'Public Policy | Legal / Policy', ''],
      ['Yuki Tanaka', 'Mercari', 'Hardware Engineer', 'Singapore', 'Singapore',
        'yuki@example.com', '', '', '', '',
        'Met at a hardware meetup', 'Organising Volunteer | General', '', 'Hardware | AV Enthusiast | Design', ''],
      ['Arjun Nair', 'Indian Institute of Science', 'Professor', 'Bangalore', 'India',
        'arjun@example.com', '+91 98800 22222', '', '', '',
        'Coordinates the campus FOSS club', 'FOSS Club Ambassador (Staff)', '', 'Government | Research / Academia', ''],
      ['Sofia Muller', 'Grafana Labs', 'Developer Advocate', 'Berlin', 'Germany',
        'sofia@example.com', '+49 151 2345 6789', '', '', 'https://linkedin.com/in/sofiamueller',
        'Spoke on an unusual track', 'Other', 'Documentation Lead', 'AI / ML | Other', 'Open Hardware Policy'],
    ];

    const csv = toCsv(COLUMNS, examples);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rolodex-contacts-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── File parsing + validation ───────────────────────────────────────────────
  type RowError = { message: string; fix: string };
  type ParsedRow = {
    line: number;
    payload: Record<string, unknown>;
    display: { name: string; org: string; contact: string };
    errors: RowError[];
  };

  let fileName = '';
  let parsed: ParsedRow[] = [];
  let parseError = '';
  // Headers in the file that don't match any contact field (data is ignored).
  let unknownHeaders: { header: string; suggestion: string | null }[] = [];
  let dragging = false;

  $: validRows = parsed.filter((r) => r.errors.length === 0);
  $: invalidRows = parsed.filter((r) => r.errors.length > 0);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Build the "fix" hint for an unrecognised role/topic token list.
  function unknownFix(bad: string[], options: { value: string; label: string }[], otherCol: string): string {
    const guesses = bad
      .map((b) => {
        const s = suggestOption(b, options);
        return s ? `“${b}” → did you mean “${s}”?` : null;
      })
      .filter(Boolean);
    if (guesses.length) return `${guesses.join(' ')} Or use “Other” and fill the ${otherCol} column.`;
    return `Use one of the allowed values listed below, or “Other” with the ${otherCol} column filled.`;
  }

  function validateRow(o: Record<string, string>, line: number): ParsedRow {
    const errors: RowError[] = [];
    const name = (o.name ?? '').trim();
    const org = (o.org ?? '').trim();
    const email = (o.email ?? '').trim();
    const secondary_email = (o.secondary_email ?? '').trim();
    const mobile = (o.mobile ?? '').trim();
    const how_you_know = (o.how_you_know ?? '').trim();

    if (!name && !org)
      errors.push({ message: 'Missing name and organisation', fix: 'Fill the “name” or the “org” column (at least one).' });
    if (!email && !mobile)
      errors.push({ message: 'Missing email and mobile', fix: 'Fill the “email” or the “mobile” column (at least one).' });
    if (email && !EMAIL_RE.test(email))
      errors.push({ message: `Invalid email “${email}”`, fix: 'Use a full address like name@example.com, or leave it blank.' });
    if (secondary_email && !EMAIL_RE.test(secondary_email))
      errors.push({ message: `Invalid secondary email “${secondary_email}”`, fix: 'Use a full address like name@example.com, or leave it blank.' });
    if (!how_you_know)
      errors.push({ message: 'Missing “how_you_know”', fix: 'Add a short note on how you know this person, e.g. “Met at IndiaFOSS 2024”.' });

    const { values: fu_roles, unknown: badRoles } = mapTokens(o.fu_roles ?? '', FU_ROLES);
    if (badRoles.length)
      errors.push({ message: `Unrecognised role${badRoles.length > 1 ? 's' : ''}: ${badRoles.join(', ')}`, fix: unknownFix(badRoles, FU_ROLES, 'fu_roles_other') });
    if (!fu_roles.length)
      errors.push({ message: 'No role in “fu_roles”', fix: 'Add at least one role, e.g. “Speaker”. Separate multiple with a pipe: “Speaker | Mentor”.' });

    const { values: topics, unknown: badTopics } = mapTokens(o.topics ?? '', TOPICS);
    if (badTopics.length)
      errors.push({ message: `Unrecognised topic${badTopics.length > 1 ? 's' : ''}: ${badTopics.join(', ')}`, fix: unknownFix(badTopics, TOPICS, 'topics_other') });
    if (!topics.length)
      errors.push({ message: 'No topic in “topics”', fix: 'Add at least one topic, e.g. “Open Source”. Separate multiple with a pipe: “Open Source | Security”.' });

    const fu_roles_other = (o.fu_roles_other ?? '').trim();
    const topics_other = (o.topics_other ?? '').trim();
    if (fu_roles.includes('other') && !fu_roles_other)
      errors.push({ message: '“Other” role needs a description', fix: 'Fill the “fu_roles_other” column with the custom role name.' });
    if (topics.includes('other') && !topics_other)
      errors.push({ message: '“Other” topic needs a description', fix: 'Fill the “topics_other” column with the custom topic name.' });

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
    unknownHeaders = [];
    try {
      const text = await file.text();
      const objects = parseCsvObjects(text);
      if (objects.length === 0) {
        parseError = 'This file has a header row but no contacts below it. Add at least one row, then re-upload.';
        return;
      }
      const known = new Set(COLUMNS);
      const headers = Object.keys(objects[0]).filter(Boolean);
      const hasKnownHeader = headers.some((h) => known.has(h));
      if (!hasKnownHeader) {
        parseError = `The first row must be a header. None of its columns matched — expected names like ${COLUMNS.slice(0, 5).join(', ')}, … . Download the template for the exact header row.`;
        return;
      }
      // Surface columns we'll ignore so silently-dropped data is visible.
      unknownHeaders = headers
        .filter((h) => !known.has(h))
        .map((h) => ({ header: h, suggestion: closest(h, COLUMNS) }));
      // +2: row 1 is the header, and arrays are 0-indexed.
      parsed = objects.map((o, i) => validateRow(o, i + 2));
    } catch {
      parseError = 'Could not read that file. Make sure it is a valid .csv exported with UTF-8 encoding.';
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
  let failures: { line: number; name: string; message: string }[] = [];
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
        failures = [...failures, {
          line: row.line,
          name: row.display.name || row.display.org || `Row #${row.line}`,
          message: msg || 'The server rejected this row. Check the values and try again.',
        }];
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
    unknownHeaders = [];
    resetResults();
  }
</script>

<svelte:head>
  <title>Import Contacts · Rolodex</title>
</svelte:head>

<div class="px-6 py-6 max-w-3xl mx-auto">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-6">
    <a href="{base}/contacts" class="btn-ghost p-2" aria-label="Back to contacts">
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
        </div>
        <button on:click={downloadTemplate} class="btn-secondary shrink-0 gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          Download template
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
        <div class="flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/40 px-4 py-3">
          <svg class="text-red-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          <p class="text-sm text-red-700 dark:text-red-300">{parseError}</p>
        </div>
      {/if}

      {#if unknownHeaders.length}
        <div class="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/40 px-4 py-3">
          <svg class="text-amber-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          <div class="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <p class="font-medium">These columns aren't recognised and will be ignored:</p>
            <ul class="space-y-0.5">
              {#each unknownHeaders as h}
                <li><code class="text-amber-800 dark:text-amber-200">{h.header}</code>{#if h.suggestion} — rename it to <code class="text-amber-800 dark:text-amber-200">{h.suggestion}</code>?{/if}</li>
              {/each}
            </ul>
          </div>
        </div>
      {/if}

      {#if parsed.length}
        <div class="flex items-center gap-3 text-sm">
          <span class="badge-green">{validRows.length} ready</span>
          {#if invalidRows.length}<span class="badge bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">{invalidRows.length} with errors</span>{/if}
        </div>

        <!-- Preview -->
        <div class="max-h-96 overflow-auto rounded-lg border border-neutral-100 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800">
          {#each parsed as row (row.line)}
            <div class="px-3 py-2 text-sm flex items-start gap-2 {row.errors.length ? 'bg-red-50/60 dark:bg-red-950/30' : ''}">
              <span class="text-[11px] text-neutral-400 w-8 shrink-0 pt-0.5">#{row.line}</span>
              <div class="min-w-0 flex-1">
                <p class="text-neutral-800 dark:text-neutral-100 truncate">
                  {row.display.name || row.display.org || '—'}
                  {#if row.display.org && row.display.name}<span class="text-neutral-400"> · {row.display.org}</span>{/if}
                </p>
                {#if row.errors.length}
                  <ul class="mt-1 space-y-1">
                    {#each row.errors as err}
                      <li class="text-xs leading-snug">
                        <span class="font-medium text-red-600 dark:text-red-400">{err.message}.</span>
                        <span class="text-neutral-500 dark:text-neutral-400">{err.fix}</span>
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="text-xs text-neutral-400 truncate">{row.display.contact}</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        {#if invalidRows.length}
          <p class="text-xs text-neutral-500 dark:text-neutral-400">Rows with errors are skipped. Fix them in your file using the hints above, then re-upload to include them.</p>
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
          <div class="text-xs space-y-1 border-t border-neutral-100 dark:border-neutral-800 pt-2">
            <p class="text-neutral-500 dark:text-neutral-400">These rows were rejected by the server and not saved:</p>
            {#each failures as f}
              <p><span class="font-medium text-neutral-700 dark:text-neutral-300">{f.name}</span> <span class="text-neutral-400">(row #{f.line})</span> — <span class="text-red-600 dark:text-red-400">{f.message}</span></p>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pb-8">
      <a href="{base}/contacts" class="btn-secondary">{done ? 'Done' : 'Cancel'}</a>
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
