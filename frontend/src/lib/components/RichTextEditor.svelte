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

  const isList = (n: Element | null): boolean => n?.tagName === 'UL' || n?.tagName === 'OL';

  function getCaretListItem(): HTMLLIElement | null {
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (!node) return null;
    return (node instanceof Element ? node : node.parentElement)?.closest('li') ?? null;
  }

  // False whenever text is selected: Backspace must delete the selection then,
  // not reinterpret the anchor as a caret and outdent instead.
  function isCaretAtStartOf(li: HTMLLIElement): boolean {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !sel.isCollapsed) return false;
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

  // Lift `li` out by one level. Two nesting shapes reach here: Chromium's
  // execCommand puts the nested list next to the parent <li>, while pasted
  // content (Docs, Word) puts it inside it. Both normalise to the former.
  function manualOutdent(li: HTMLLIElement) {
    const innerList = li.parentElement;
    if (!innerList) return;
    // Insert after the whole nested block — the parent <li> when the list hangs
    // off it, otherwise the list itself.
    const host = isList(innerList.parentElement) ? innerList : innerList.parentElement;
    const outerList = host?.parentElement;
    if (!host || !outerList) return;

    // Items below `li` are carried along one level down, so the visible order
    // never changes. A list directly after `li` already holds its children —
    // reuse it as the tail rather than wrapping it into another level.
    const next = li.nextElementSibling;
    const tail = isList(next) ? (next as Element) : document.createElement(innerList.tagName);
    let sib = tail === next ? tail.nextElementSibling : li.nextElementSibling;
    while (sib) {
      const after = sib.nextElementSibling;
      tail.appendChild(sib);
      sib = after;
    }

    outerList.insertBefore(li, host.nextSibling);
    if (tail.children.length) li.after(tail);

    if (!innerList.querySelector('li')) {
      innerList.remove();
    }
    const range = document.createRange();
    range.selectNodeContents(li);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    sync();
  }

  function exitList(li: HTMLLIElement) {
    const list = li.parentElement;
    if (!list) return;

    const line = document.createElement('div');
    line.innerHTML = '<br>';

    const tail = document.createElement(list.tagName);
    let sib = li.nextElementSibling;
    while (sib) {
      const next = sib.nextElementSibling;
      tail.appendChild(sib);
      sib = next;
    }

    list.after(line);
    if (tail.children.length) line.after(tail);

    li.remove();
    if (!list.children.length) list.remove();

    const range = document.createRange();
    range.selectNodeContents(line);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    sync();
  }

  function handleBackspace(e: KeyboardEvent) {
    const li = getCaretListItem();
    if (!li || !isCaretAtStartOf(li)) return;

    const depth = listDepth(li);

    if (depth > 1) {
      e.preventDefault();
      manualOutdent(li);
      return;
    }

    if (depth === 1 && !li.textContent?.trim()) {
      e.preventDefault();
      exitList(li);
    }
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
