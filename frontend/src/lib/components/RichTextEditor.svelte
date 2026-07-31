<script lang="ts">
  import { onMount } from 'svelte';

  export let value = '';            // HTML string (two-way bound)
  export let id = '';
  export let placeholder = '';
  export let invalid = false;

  let el: HTMLDivElement;
  let focused = false;

  onMount(() => {
    if (el) el.innerHTML = value || '';
  });

  // Reflect external value changes (initial load, programmatic reset) into the
  // editor — but never while the user is typing, to avoid caret jumps.
  $: if (el && !focused && (value || '') !== el.innerHTML) {
    el.innerHTML = value || '';
  }

  function sync() {
    value = el.innerHTML;
  }

  
  function getCaretListItem(): HTMLLIElement | null {
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (!node) return null;
    return (node instanceof Element ? node : node.parentElement)?.closest('li') ?? null;
  }

  function isCaretAtStartOf(li: HTMLLIElement): boolean {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return false;
    const range = document.createRange();
    range.selectNodeContents(li);
    range.setEnd(sel.anchorNode, sel.anchorOffset);
    return range.toString().length === 0;
  }

  function handleTab(e: KeyboardEvent) {
    if (!getCaretListItem()) return;
    e.preventDefault();
    exec(e.shiftKey ? 'outdent' : 'indent');
  }

  function listDepth(li: HTMLLIElement): number {
    let depth = 0;
    let node: Element | null = li.parentElement;
    while (node && node !== el) {
      if (node.tagName === 'UL' || node.tagName === 'OL') depth++;
      node = node.parentElement;
    }
    return depth;
  }

  function manualOutdent(li: HTMLLIElement) {
    const innerList = li.parentElement;   // the <ul>/<ol> li currently lives in
    if (!innerList) return;
    const outerList = innerList.parentElement; // one level up
    if (!outerList) return;

    // Move li to sit right after its current wrapping list, one level up.
    outerList.insertBefore(li, innerList.nextSibling);

    // If that inner list has no items left, remove the now-empty wrapper.
    if (!innerList.querySelector('li')) {
      innerList.remove();
    }

    // Caret goes to the start of li in its new spot - deterministic, since
    // we moved the node ourselves instead of asking execCommand to.
    const range = document.createRange();
    range.selectNodeContents(li);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    sync();
  }

  function handleBackspace(e: KeyboardEvent) {
    const li = getCaretListItem();
    if (!li || !isCaretAtStartOf(li)) return;
    if (listDepth(li) <= 1) return; // depth 1 = top-level, nothing to outdent

    e.preventDefault();
    manualOutdent(li);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') handleTab(e);
    else if (e.key === 'Backspace') handleBackspace(e);
  }

  // mousedown|preventDefault keeps the editor's text selection so the command
  // applies to the highlighted text instead of losing focus first.
  function exec(cmd: string, arg?: string) {
    el.focus();
    document.execCommand(cmd, false, arg);
    sync();
  }

  function addLink() {
    const url = prompt('Link URL (https://…)');
    if (!url) return;
    const v = url.trim();
    exec('createLink', SAFE.test(v) ? v : `https://${v}`);
  }
  const SAFE = /^(https?:|mailto:)/i;

  const TOOLS = [
    { cmd: 'bold', label: 'B', title: 'Bold', cls: 'font-bold' },
    { cmd: 'italic', label: 'I', title: 'Italic', cls: 'italic' },
    { cmd: 'underline', label: 'U', title: 'Underline', cls: 'underline' },
    { cmd: 'insertUnorderedList', label: '• List', title: 'Bulleted list', cls: '' },
    { cmd: 'insertOrderedList', label: '1. List', title: 'Numbered list', cls: '' },
  ];
</script>

<div class="rounded-lg border {invalid ? 'border-red-400 ring-2 ring-red-400' : 'border-neutral-200 dark:border-neutral-700'} bg-white dark:bg-neutral-900 overflow-hidden focus-within:ring-2 focus-within:ring-accent dark:focus-within:ring-accent-dark transition-all">
  <div class="flex items-center gap-0.5 px-1.5 py-1 border-b border-neutral-100 dark:border-neutral-800">
    {#each TOOLS as t}
      <button
        type="button"
        title={t.title}
        on:mousedown|preventDefault={() => exec(t.cmd)}
        class="px-2 py-1 rounded text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 {t.cls}"
      >{t.label}</button>
    {/each}
    <button
      type="button"
      title="Add link"
      on:mousedown|preventDefault={addLink}
      class="px-2 py-1 rounded text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
    >🔗 Link</button>
  </div>

  <div
    bind:this={el}
    {id}
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    tabindex="0"
    data-placeholder={placeholder}
    on:input={sync}
    on:keydown={handleKeydown}
    on:focus={() => (focused = true)}
    on:blur={() => { focused = false; sync(); }}
    class="richtext px-3 py-2 text-sm min-h-[5rem] text-neutral-900 dark:text-neutral-100 focus:outline-none"
  ></div>
</div>
