// Possible duplicates of a contact being typed in (issue #27).
//
// Nothing stops two members entering the same person twice — the contacts
// collection has no uniqueness rule, and none is wanted: names collide
// legitimately, and production already holds a few doubles that a unique index
// would refuse to apply over. So the check is a *hint* at the point of entry:
// as a name, email or mobile is typed, the forms ask for anyone already in the
// Rolodex who looks like the same person, and offer their profile instead.
//
// Matching is deliberately loose. The full name as a substring catches an exact
// re-entry; each longer name token on its own catches a first name spelt two
// ways while the surname still agrees; email and mobile catch a spelling that
// shares neither. The server does a case-insensitive `~` search to find
// candidates, then each is verified here — numbers are stored however they were
// typed ("+91 99000 22222"), so the server can only be asked for the last few
// digits, and the full number is compared client-side. Nothing has to hold every
// contact in the browser the way the org roster does.

import { pb } from './pb';
import type { Contact } from './types';

export type DuplicateReason = 'email' | 'mobile' | 'name';

export type DuplicateMatch = {
  contact: Contact;
  /** What made this look like the same person — shown as badges on the row. */
  reasons: DuplicateReason[];
};

/** Typing fewer characters than this asks nothing — one letter matches everyone. */
const MIN_NAME = 3;
/** Name tokens shorter than this ("Dr", "Roy") are too common to match on alone. */
const MIN_TOKEN = 4;
/** Digits typed before a number is worth looking up at all. */
const MIN_MOBILE_DIGITS = 6;
/** Candidates fetched; more than are shown, since some fail verification. */
const FETCH = 12;
const SHOW = 6;

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const digits = (s: string) => (s ?? '').replace(/\D/g, '');
const lower = (s: string | undefined) => (s ?? '').trim().toLowerCase();
const tokens = (name: string) => [...new Set(name.toLowerCase().split(/\s+/).filter((t) => t.length >= MIN_TOKEN))];

/** Do two numbers denote the same line? Compared on their last ten digits, either way round. */
function sameNumber(a: string, b: string): boolean {
  const x = digits(a).slice(-10);
  const y = digits(b).slice(-10);
  return x.length >= MIN_MOBILE_DIGITS && y.length >= MIN_MOBILE_DIGITS && (x.endsWith(y) || y.endsWith(x));
}

/** Contacts who may already be the person described by these fields, strongest signal first. */
export async function findPossibleDuplicates(input: { name?: string; email?: string; mobile?: string }): Promise<DuplicateMatch[]> {
  const name = (input.name ?? '').trim();
  const email = lower(input.email);
  const mobile = digits(input.mobile ?? '');

  const clauses: string[] = [];
  if (name.length >= MIN_NAME) {
    clauses.push(`name ~ '${esc(name)}'`);
    for (const tok of tokens(name)) clauses.push(`name ~ '${esc(tok)}'`);
  }
  if (email.includes('@')) {
    clauses.push(`email ~ '${esc(email)}'`, `secondary_email ~ '${esc(email)}'`);
  }
  if (mobile.length >= MIN_MOBILE_DIGITS) {
    // Loose on purpose: the stored value may have spaces or a country code in
    // it, so ask for the last five digits and let sameNumber() decide below.
    const tail = mobile.slice(-5);
    clauses.push(`mobile ~ '${esc(tail)}'`, `secondary_mobile ~ '${esc(tail)}'`);
  }
  if (!clauses.length) return [];

  const r = await pb.collection('contacts').getList<Contact>(1, FETCH, {
    filter: `deleted_at = null && (${clauses.join(' || ')})`,
    sort: 'name',
    expand: 'orgs,added_by',
  });

  const nameLower = name.toLowerCase();
  const toks = tokens(name);
  const matches: DuplicateMatch[] = [];
  for (const contact of r.items) {
    const reasons: DuplicateReason[] = [];
    if (email.includes('@') && [contact.email, contact.secondary_email].map(lower).includes(email)) reasons.push('email');
    if (mobile.length >= MIN_MOBILE_DIGITS && [contact.mobile, contact.secondary_mobile].some((m) => sameNumber(m, mobile))) reasons.push('mobile');
    const cn = lower(contact.name);
    if (name.length >= MIN_NAME && cn && (cn.includes(nameLower) || toks.some((t) => cn.includes(t)))) reasons.push('name');
    if (reasons.length) matches.push({ contact, reasons });
  }

  // A shared email or number is a much stronger sign than a similar name.
  const weight = (m: DuplicateMatch) => (m.reasons.includes('email') ? 2 : 0) + (m.reasons.includes('mobile') ? 2 : 0) + (m.reasons.includes('name') ? 1 : 0);
  return matches.sort((a, b) => weight(b) - weight(a)).slice(0, SHOW);
}
