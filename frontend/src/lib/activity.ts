// Rendering helpers for activity participants.
//
// An activity carries a list of contacts plus an optional role per contact
// (`contact_roles`, keyed by contact id). Four places show participants — the
// activity feed, a contact's timeline, an organisation's timeline and the admin
// dashboard — so the "Name (Role)" shape lives here rather than being spelled out
// four times and drifting.

import { participantRoleLabel } from './constants';
import { contactLabel } from './org';
import type { Activity, Contact } from './types';

/** Just enough of an Activity to read roles off. */
type WithRoles = { contact_roles?: Record<string, string> };

/** This contact's role on this activity as a display label; '' when unset. */
export function roleLabel(activity: WithRoles | null | undefined, contactId: string): string {
  const role = activity?.contact_roles?.[contactId];
  return role ? participantRoleLabel(role) : '';
}

/** "Ananya Sharma (Speaker)", or just the name when no role was recorded. */
export function participantLabel(activity: WithRoles | null | undefined, contact: Contact): string {
  const role = roleLabel(activity, contact.id);
  return role ? `${contactLabel(contact)} (${role})` : contactLabel(contact);
}

/**
 * Everyone on an activity with their roles, on one line.
 *
 * `limit` names that many and counts the remainder ("+2 more"), so a
 * twenty-person activity still fits a single row.
 */
export function participantLine(activity: (WithRoles & { expand?: { contacts?: Contact[] } }) | null | undefined, limit?: number): string {
  const people = activity?.expand?.contacts ?? [];
  if (!people.length) return '';
  const shown = typeof limit === 'number' ? people.slice(0, limit) : people;
  const line = shown.map((c) => participantLabel(activity, c)).join(', ');
  const rest = people.length - shown.length;
  return rest > 0 ? `${line} +${rest} more` : line;
}

/** Participants other than the given contact — for "with …" on their timeline. */
export function otherParticipants(activity: Activity, contactId: string): Contact[] {
  return (activity.expand?.contacts ?? []).filter((c) => c.id !== contactId);
}

/**
 * The participant a one-line summary should link to: the first on the activity.
 *
 * `activities.contacts` is a multi-relation — there is no `contact` field — so a
 * row that names several people on one line still needs a single href. The first
 * participant is it, mirroring how the first of a contact's orgs is the primary
 * one. Returns '' when a query forgot `expand: 'contacts'`, so callers can skip
 * the link rather than pointing it at nothing.
 */
export function primaryParticipantId(activity: { expand?: { contacts?: Contact[] } } | null | undefined): string {
  return activity?.expand?.contacts?.[0]?.id ?? '';
}
