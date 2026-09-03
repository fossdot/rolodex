export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employee';
  avatar: string;
  created: string;
  updated: string;
  /**
   * A member who has left. They can't sign in, but their name stays on every
   * contact and activity they added — unlike a deleted account, which would
   * blank that attribution. Set from /admin/team; see the guardrails in
   * pb_hooks/main.pb.js.
   */
  disabled?: boolean;
}

export interface Organisation {
  id: string;
  name: string;
  created: string;
  updated: string;
}

export interface Contact {
  id: string;
  name: string;
  /**
   * Organisation ids, in display order — the first is the contact's primary
   * organisation and the one compact UI shows. Read names via `$lib/org`
   * helpers, which work off `expand.orgs`.
   */
  orgs: string[];
  designation: string;
  /**
   * Optional title per organisation, keyed by organisation id — a contact may be
   * a Professor at one and a Maintainer at another. `designation` above stays the
   * headline shown wherever only one line fits.
   */
  org_designations: Record<string, string>;
  city: string;
  country: string;
  email: string;
  mobile: string;
  secondary_email: string;
  secondary_mobile: string;
  how_you_know: string;
  linkedin: string;
  photo: string;
  fu_roles: string[];
  fu_roles_other: string;
  topics: string[];
  topics_other: string;
  added_by: string;
  deleted_at?: string;
  deleted_by?: string;
  expand?: {
    added_by?: User;
    deleted_by?: User;
    orgs?: Organisation[];
  };
  created: string;
  updated: string;
}

export interface Reaction {
  id: string;
  activity: string;
  user: string;
  emoji: string;
  expand?: {
    user?: User;
  };
  created: string;
}

export interface ContactLogChange {
  field: string;
  from: string;
  to: string;
}

export interface ContactLog {
  id: string;
  contact: string;
  editor: string;
  changes: ContactLogChange[];
  expand?: {
    editor?: User;
  };
  created: string;
}

export interface Reminder {
  id: string;
  contact: string;
  activity: string;
  remind_at: string;
  /** The single assignee — whose bell this shows in, and the email's To. */
  notify: string;
  /** Team members copied on the email (ids into `users`). Email only. */
  cc: string[];
  /** Comma-separated external addresses (e.g. a Google group). Email only. */
  cc_emails: string;
  created_by: string;
  sent_at?: string;
  expand?: {
    contact?: Contact;
    activity?: Activity;
    notify?: User;
    cc?: User[];
    created_by?: User;
  };
  created: string;
  updated: string;
}

export interface Activity {
  id: string;
  /**
   * Everyone the activity involved (issue #6) — a summit might list a speaker,
   * an organiser and a sponsor on one row. Always at least one, enforced by the
   * activities hooks in pb_hooks/main.pb.js.
   */
  contacts: string[];
  /**
   * What each participant's part was, keyed by contact id — `{ <id>: 'speaker' }`.
   * Values come from PARTICIPANT_ROLES; the server prunes entries for anyone not
   * in `contacts` and rejects unknown roles.
   */
  contact_roles: Record<string, string>;
  activity_type: string;
  event_name: string;
  event_link: string;
  date: string;
  notes: string;
  logged_by: string;
  deleted_at?: string;
  deleted_by?: string;
  expand?: {
    logged_by?: User;
    contacts?: Contact[];
    deleted_by?: User;
  };
  created: string;
  updated: string;
}
