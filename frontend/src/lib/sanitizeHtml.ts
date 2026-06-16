// Allowlist HTML sanitizer for the rich-text fields (activity notes,
// how_you_know). Users see each other's content, so this MUST run on save
// AND on render. Only a small set of formatting tags survives; every
// attribute is dropped except a safe href on links.

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'P', 'A']);
const SAFE_HREF = /^(https?:|mailto:)/i;

function clean(src: Node, dest: HTMLElement, doc: Document) {
  src.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      dest.appendChild(doc.createTextNode(child.textContent ?? ''));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return; // drop comments etc.

    const tag = (child as Element).tagName;
    if (ALLOWED.has(tag)) {
      const el = doc.createElement(tag.toLowerCase());
      if (tag === 'A') {
        const href = ((child as Element).getAttribute('href') ?? '').trim();
        if (SAFE_HREF.test(href)) {
          el.setAttribute('href', href);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
      clean(child, el, doc);
      dest.appendChild(el);
    } else {
      // Disallowed tag (script, style, span, div, img…): drop the tag but
      // keep its text content.
      clean(child, dest, doc);
    }
  });
}

/** Return HTML containing only the allowlisted tags/attributes. */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const out = doc.createElement('div');
  clean(doc.body, out, doc);
  return out.innerHTML;
}

/** Strip all tags to plain text (for validation, diffs, previews). */
export function htmlToText(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  return (doc.body.textContent ?? '').replace(/ /g, ' ').trim();
}
