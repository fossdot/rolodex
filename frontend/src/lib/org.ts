// A contact can belong to several organisations (issue #8). `contacts.orgs` is a
// multi-relation, so names live on the expanded records — every query that
// displays an organisation must ask for `orgs` (or `contact.orgs` when the
// contact is itself expanded).
//
// The FIRST organisation is the contact's primary one: it is what shows wherever
// there is only room for a single line (list rows, the activity feed, reminder
// emails). The contact page shows the full set.

import { pb } from './pb';
import type { Contact, Organisation } from './types';

/** Just enough of a Contact to read organisations off — keeps call sites loose. */
type WithOrgs = {
  name?: string;
  org_designations?: Record<string, string>;
  expand?: { orgs?: { id: string; name: string }[] };
};

/** An organisation plus this contact's optional title there, in display order. */
export type OrgEntry = { id: string; name: string; designation: string };

/**
 * Organisations with their per-org designation attached. The first entry is the
 * primary organisation. Use this anywhere the pairing matters (the profile);
 * `orgNames`/`primaryOrg` remain fine where only names are shown.
 */
export function orgEntries(c: WithOrgs | null | undefined): OrgEntry[] {
  const designations = c?.org_designations ?? {};
  return (c?.expand?.orgs ?? [])
    .filter((o) => o?.name)
    .map((o) => ({ id: o.id, name: o.name, designation: designations[o.id] ?? '' }));
}

/** Every organisation name, in order. Empty when none / not expanded. */
export function orgNames(c: WithOrgs | null | undefined): string[] {
  return (c?.expand?.orgs ?? []).map((o) => o.name).filter(Boolean);
}

/** The primary organisation — for anywhere only one fits. '' when none. */
export function primaryOrg(c: WithOrgs | null | undefined): string {
  return orgNames(c)[0] ?? '';
}

/** All organisations on one line, for tooltips and secondary text. */
export function orgLine(c: WithOrgs | null | undefined, sep = ' · '): string {
  return orgNames(c).join(sep);
}

/**
 * What to call a contact. Organisation-only records are legitimate (a sponsor
 * company with no named person yet), so fall back to the primary org.
 */
export function contactLabel(c: WithOrgs | null | undefined): string {
  return c?.name || primaryOrg(c) || 'Unknown';
}

/** True when the contact has at least one organisation. */
export function hasOrg(c: Contact | null | undefined): boolean {
  return orgNames(c).length > 0;
}

/** The whole organisation roster, for autocomplete and name→id resolution. */
export async function loadOrganisations(): Promise<Organisation[]> {
  return pb.collection('organisations').getFullList<Organisation>({ sort: 'name', batch: 200 });
}

/**
 * Turn the names a user typed into organisation ids, creating any that are new.
 *
 * Forms hold organisation *names* rather than ids so that abandoning a form never
 * leaves orphan organisation rows behind — rows are only created here, on save.
 *
 * Matching is case-insensitive against the already-loaded roster, so typing
 * "gnome foundation" links to the existing "GNOME Foundation" instead of
 * attempting a near-duplicate (which the collection's unique index rejects).
 */
export async function resolveOrgIds(names: string[], known: Organisation[]): Promise<string[]> {
  return (await resolveOrgs(names, known)).ids;
}

/**
 * As `resolveOrgIds`, but also hands back the name→id mapping.
 *
 * Forms hold organisation *names* while `org_designations` is keyed by
 * organisation *id*, so saving a per-org title needs both.
 */
export async function resolveOrgs(
  names: string[],
  known: Organisation[]
): Promise<{ ids: string[]; idByLowerName: Map<string, string> }> {
  // Dedupe case-insensitively, keeping the first spelling and the given order.
  const wanted = [
    ...new Map(
      names.map((n) => n.trim()).filter(Boolean).map((n) => [n.toLowerCase(), n])
    ).values(),
  ];
  if (!wanted.length) return { ids: [], idByLowerName: new Map() };

  let byLower = new Map(known.map((o) => [o.name.toLowerCase(), o.id]));
  const ids: string[] = [];

  for (const name of wanted) {
    const hit = byLower.get(name.toLowerCase());
    if (hit) {
      ids.push(hit);
      continue;
    }
    try {
      const made = await pb.collection('organisations').create<Organisation>({ name });
      byLower.set(name.toLowerCase(), made.id);
      ids.push(made.id);
    } catch (e) {
      // Someone else created the same org between our load and this write. Re-read
      // the roster and use theirs rather than failing the whole save.
      byLower = new Map((await loadOrganisations()).map((o) => [o.name.toLowerCase(), o.id]));
      const retry = byLower.get(name.toLowerCase());
      if (!retry) throw e;
      ids.push(retry);
    }
  }
  return { ids, idByLowerName: byLower };
}
