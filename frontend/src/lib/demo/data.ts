// Seed data for the public interactive demo (no backend). All people, orgs and
// activities here are FICTIONAL — invented for the demo, not real contacts.
// The mock client (./mockPb) serves and mutates copies of these in memory.

export interface Rec {
  [k: string]: unknown;
  id: string;
  created: string;
  updated: string;
}

const ISO = (d: string) => `${d}T09:30:00.000Z`;

// ── Users (the demo team) ───────────────────────────────────────────────────
export const DEMO_USERS: Rec[] = [
  { id: 'u_admin', email: 'aarthi@fossunited.org', name: 'Aarthi Menon', role: 'admin', avatar: '', created: ISO('2025-01-04'), updated: ISO('2025-01-04') },
  { id: 'u_rahul', email: 'rahul@fossunited.org', name: 'Rahul Verma', role: 'employee', avatar: '', created: ISO('2025-01-12'), updated: ISO('2025-01-12') },
  { id: 'u_sneha', email: 'sneha@fossunited.org', name: 'Sneha Iyer', role: 'employee', avatar: '', created: ISO('2025-02-02'), updated: ISO('2025-02-02') },
  { id: 'u_karthik', email: 'karthik@fossunited.org', name: 'Karthik Nair', role: 'employee', avatar: '', created: ISO('2025-03-09'), updated: ISO('2025-03-09') },
];

// The viewer is signed in as this user (an admin, so the demo shows everything).
export const DEMO_AUTH_USER = DEMO_USERS[0];

const c = (
  id: string,
  name: string,
  org: string,
  designation: string,
  city: string,
  email: string,
  mobile: string,
  how: string,
  roles: string[],
  topics: string[],
  added_by: string,
  created: string,
  extra: Partial<Rec> = {}
): Rec => ({
  id, name, org, designation, city, country: 'India', email, mobile,
  secondary_email: '', secondary_mobile: '',
  how_you_know: `<p>${how}</p>`, linkedin: '', photo: '',
  fu_roles: roles, fu_roles_other: '', topics, topics_other: '',
  added_by, deleted_at: '', deleted_by: '',
  created: ISO(created), updated: ISO(created), ...extra,
});

// ── Contacts ────────────────────────────────────────────────────────────────
export const DEMO_CONTACTS: Rec[] = [
  c('c_ananya', 'Ananya Sharma', 'IIT Bombay', 'Professor, CSE', 'Mumbai', 'ananya@example.org', '+91 98200 11111', 'Keynote speaker at IndiaFOSS 2025; introduced by the Bombay meetup group.', ['speaker', 'mentor'], ['ai_ml', 'research'], 'u_admin', '2025-09-14'),
  c('c_dev', 'Dev Kumar', 'Zerodha', 'Engineering Lead', 'Bangalore', 'dev@example.org', '+91 99000 22222', 'Sponsor contact for FOSS Hack; very responsive.', ['sponsor'], ['open_source', 'finance'], 'u_rahul', '2025-09-22'),
  c('c_meera', 'Meera Pillai', 'Self-employed', 'Open Source Consultant', 'Kochi', 'meera@example.org', '+91 99461 33333', 'Long-time Kerala community organiser; hosts the Kochi meetup.', ['meetup_host', 'mentor'], ['community', 'devops'], 'u_sneha', '2025-10-03'),
  c('c_arjun', 'Arjun Reddy', 'NIT Warangal', 'Final-year Student', 'Warangal', 'arjun@example.org', '+91 90000 44444', 'FOSS Club ambassador; started a campus chapter this year.', ['foss_club_ambassador_student'], ['education', 'community'], 'u_karthik', '2025-10-19'),
  c('c_fatima', 'Fatima Khan', 'Red Hat', 'Principal Engineer', 'Pune', 'fatima@example.org', '+91 98220 55555', 'Spoke on systemd internals; happy to mentor.', ['speaker', 'mentor', 'project_maintainer'], ['devops', 'open_source'], 'u_admin', '2025-11-01'),
  c('c_george', 'George Thomas', 'Infosys', 'VP Engineering', 'Bangalore', 'george@example.org', '+91 99001 66666', 'Potential corporate sponsor; met at NASSCOM event.', ['sponsor', 'gov_board_expert'], ['government', 'public_policy'], 'u_rahul', '2025-11-15'),
  c('c_priya', 'Priya Nair', 'Self-employed', 'UX Designer', 'Chennai', 'priya@example.org', '+91 90031 77777', 'Designed posters for Chennai meetup; great with community design.', ['organising_volunteer'], ['design', 'community'], 'u_sneha', '2025-11-28'),
  c('c_sameer', 'Sameer Joshi', 'Tata Elxsi', 'Hardware Architect', 'Pune', 'sameer@example.org', '+91 98221 88888', 'Hardware track judge; deep RISC-V knowledge.', ['mentor'], ['hardware', 'technologist'], 'u_karthik', '2025-12-06'),
  c('c_lakshmi', 'Lakshmi Rao', 'IISc Bangalore', 'PhD Researcher', 'Bangalore', 'lakshmi@example.org', '+91 99002 99999', 'Research collaborator; presented on ML reproducibility.', ['speaker'], ['ai_ml', 'research'], 'u_admin', '2025-12-20'),
  c('c_imran', 'Imran Sheikh', 'Freshworks', 'Staff Engineer', 'Chennai', 'imran@example.org', '+91 90032 10101', 'Reviewed grant applications last cycle.', ['mentor'], ['open_source', 'security'], 'u_rahul', '2026-01-08'),
  c('c_nisha', 'Nisha Gupta', 'Self-employed', 'Policy Researcher', 'Delhi', 'nisha@example.org', '+91 98110 12121', 'Public policy expert; advises on open data.', ['gov_board_expert'], ['public_policy', 'legal'], 'u_sneha', '2026-01-21'),
  c('c_rohit', 'Rohit Desai', 'Razorpay', 'Backend Engineer', 'Bangalore', 'rohit@example.org', '+91 99003 13131', 'Volunteer at FOSS Hack; strong Go contributor.', ['organising_volunteer', 'project_maintainer'], ['open_source', 'devops'], 'u_karthik', '2026-02-04'),
  c('c_anjali', 'Anjali Menon', 'Govt. of Kerala', 'IT Officer', 'Thiruvananthapuram', 'anjali@example.org', '+91 99461 14141', 'Government liaison for the state FOSS policy.', ['gov_board_expert'], ['government', 'public_policy'], 'u_admin', '2026-02-18'),
  c('c_vikram', 'Vikram Singh', 'Self-employed', 'DevRel Consultant', 'Jaipur', 'vikram@example.org', '+91 90001 15151', 'Helped run the Jaipur meetup; great community energy.', ['meetup_host', 'speaker'], ['community', 'devops'], 'u_rahul', '2026-03-05'),
  c('c_tara', 'Tara Krishnan', 'Swiggy', 'Data Scientist', 'Bangalore', 'tara@example.org', '+91 99004 16161', 'AI/ML workshop facilitator at IndiaFOSS.', ['speaker', 'mentor'], ['ai_ml', 'education'], 'u_sneha', '2026-03-22'),
  c('c_farhan', 'Farhan Ali', 'GitHub', 'Developer Advocate', 'Online', 'farhan@example.org', '+91 90033 17171', 'Connected us with the GitHub sponsorship team.', ['sponsor', 'speaker'], ['open_source', 'community'], 'u_karthik', '2026-04-10'),
  // a couple of soft-deleted records (admin can see/restore these in the demo)
  c('c_old1', 'Suresh Old', 'Defunct Co', 'Manager', 'Mumbai', 'suresh@example.org', '+91 98200 18181', 'Duplicate record, replaced.', ['general'], ['community'], 'u_rahul', '2025-08-02', { deleted_at: ISO('2026-01-30'), deleted_by: 'u_admin' }),
  c('c_old2', 'Test Entry', 'Sample Org', '', 'Delhi', 'test@example.org', '', 'Created by mistake during onboarding.', ['general'], ['open_source'], 'u_sneha', '2025-08-20', { deleted_at: ISO('2026-02-11'), deleted_by: 'u_admin' }),
];

// ── Activities ──────────────────────────────────────────────────────────────
let aId = 0;
const a = (contact: string, type: string, event: string, date: string, notes: string, logged_by: string): Rec => ({
  id: `a_${++aId}`,
  contact, activity_type: type, event_name: event, event_link: '',
  date, notes: `<p>${notes}</p>`, logged_by,
  deleted_at: '', deleted_by: '',
  created: ISO(date), updated: ISO(date),
});

export const DEMO_ACTIVITIES: Rec[] = [
  a('c_ananya', 'spoke_at_event', 'IndiaFOSS 2025', '2025-09-20', 'Delivered the AI/ML keynote — packed room, great Q&A.', 'u_admin'),
  a('c_ananya', 'mentored_hackathon', 'FOSS Hack 2025', '2025-12-13', 'Mentored two student teams on ML tooling.', 'u_rahul'),
  a('c_dev', 'sponsored_event', 'FOSS Hack 2025', '2025-11-30', 'Zerodha confirmed gold-tier sponsorship.', 'u_rahul'),
  a('c_dev', 'networking_call', 'Sponsor sync', '2026-02-12', 'Discussed sponsoring the 2026 city meetups.', 'u_admin'),
  a('c_meera', 'hosted_meetup', 'Kochi FOSS Meetup', '2025-10-11', 'Hosted 40+ attendees; lightning talks went well.', 'u_sneha'),
  a('c_meera', 'hosted_meetup', 'Kochi FOSS Meetup', '2026-01-17', 'Second edition — partnered with a local college.', 'u_sneha'),
  a('c_arjun', 'established_foss_club', 'NIT Warangal', '2025-10-25', 'Launched the campus FOSS club with 30 members.', 'u_karthik'),
  a('c_arjun', 'participated_hackathon', 'FOSS Hack 2025', '2025-12-13', 'Team built an offline-first notes app.', 'u_karthik'),
  a('c_fatima', 'spoke_at_event', 'IndiaFOSS 2025', '2025-09-21', 'Talk on systemd internals; slides shared with community.', 'u_admin'),
  a('c_fatima', 'conducted_workshop', 'Pune DevOps Day', '2026-03-14', 'Hands-on container internals workshop.', 'u_admin'),
  a('c_george', 'networking_call', 'NASSCOM intro', '2025-11-18', 'Explored a corporate open-source program.', 'u_rahul'),
  a('c_priya', 'volunteered', 'Chennai Meetup', '2025-12-02', 'Designed event posters and signage.', 'u_sneha'),
  a('c_sameer', 'judged_project', 'FOSS Hack 2025', '2025-12-14', 'Judged the hardware track; thoughtful feedback.', 'u_karthik'),
  a('c_lakshmi', 'spoke_at_event', 'ML Repro Workshop', '2025-12-22', 'Presented on reproducible ML pipelines.', 'u_admin'),
  a('c_imran', 'reviewed_grant', 'FOSS Grants Q4', '2026-01-10', 'Reviewed 6 grant applications.', 'u_rahul'),
  a('c_nisha', 'panel_discussion', 'Open Data Policy Panel', '2026-01-24', 'Spoke on open government data standards.', 'u_sneha'),
  a('c_rohit', 'contributed_oss', 'FOSS Hack 2025', '2026-02-06', 'Merged a sizeable patch into the event platform.', 'u_karthik'),
  a('c_anjali', 'networking_call', 'Kerala IT dept', '2026-02-20', 'Discussed state-level FOSS adoption.', 'u_admin'),
  a('c_vikram', 'hosted_meetup', 'Jaipur FOSS Meetup', '2026-03-07', 'First Jaipur meetup — 25 attendees.', 'u_rahul'),
  a('c_tara', 'conducted_workshop', 'IndiaFOSS 2026 (planning)', '2026-03-24', 'Planned an AI/ML beginner workshop.', 'u_sneha'),
  a('c_farhan', 'connected_sponsor', 'GitHub Sponsors', '2026-04-12', 'Introduced the GitHub sponsorship team.', 'u_karthik'),
  a('c_farhan', 'spoke_at_event', 'Online DevRel AMA', '2026-05-09', 'Ran an AMA on developer relations.', 'u_admin'),
  a('c_tara', 'spoke_at_event', 'AI Night Bangalore', '2026-05-28', 'Talk on practical LLM evaluation.', 'u_sneha'),
  a('c_dev', 'received_grant', 'Infra Grant', '2026-06-04', 'Helped a maintainer secure an infra grant.', 'u_rahul'),
  a('c_meera', 'networking_call', 'Community sync', '2026-06-12', 'Planning the next Kochi edition.', 'u_sneha'),
  a('c_fatima', 'networking_call', 'Mentorship intro', '2026-06-18', 'Agreed to mentor two new maintainers.', 'u_admin'),
];

// ── Reactions ───────────────────────────────────────────────────────────────
let rId = 0;
const r = (activity: string, user: string, emoji: string, date: string): Rec => ({
  id: `r_${++rId}`, activity, user, emoji, created: ISO(date), updated: ISO(date),
});
export const DEMO_REACTIONS: Rec[] = [
  r('a_1', 'u_rahul', '🎉', '2025-09-20'), r('a_1', 'u_sneha', '👏', '2025-09-20'), r('a_1', 'u_karthik', '🔥', '2025-09-21'),
  r('a_3', 'u_admin', '🎉', '2025-11-30'), r('a_3', 'u_sneha', '❤️', '2025-12-01'),
  r('a_5', 'u_admin', '👏', '2025-10-11'), r('a_5', 'u_rahul', '👍', '2025-10-12'),
  r('a_7', 'u_admin', '🔥', '2025-10-25'), r('a_7', 'u_rahul', '🎉', '2025-10-26'), r('a_7', 'u_sneha', '👏', '2025-10-26'),
  r('a_21', 'u_admin', '🎉', '2026-04-12'), r('a_21', 'u_rahul', '🔥', '2026-04-13'),
  r('a_24', 'u_sneha', '❤️', '2026-06-04'), r('a_24', 'u_karthik', '👏', '2026-06-05'),
];

// ── Contact edit history ─────────────────────────────────────────────────────
let lId = 0;
const log = (contact: string, editor: string, date: string, changes: { field: string; from: string; to: string }[]): Rec => ({
  id: `l_${++lId}`, contact, editor, changes, created: ISO(date), updated: ISO(date),
});
export const DEMO_CONTACT_LOGS: Rec[] = [
  log('c_ananya', 'u_admin', '2025-10-02', [{ field: 'Designation', from: 'Asst. Professor', to: 'Professor, CSE' }]),
  log('c_dev', 'u_rahul', '2026-02-12', [{ field: 'Mobile', from: '—', to: '+91 99000 22222' }, { field: 'FOSS United roles', from: 'Sponsor', to: 'Sponsor' }]),
  log('c_fatima', 'u_admin', '2026-06-18', [{ field: 'How you know them', from: 'Met at a conference.', to: 'Spoke on systemd internals; happy to mentor.' }]),
];

export function freshDb(): Record<string, Rec[]> {
  // deep-ish clone so the demo can mutate freely and a reload resets it
  const clone = (arr: Rec[]) => arr.map((x) => ({ ...x, fu_roles: Array.isArray(x.fu_roles) ? [...(x.fu_roles as string[])] : x.fu_roles, topics: Array.isArray(x.topics) ? [...(x.topics as string[])] : x.topics, changes: Array.isArray(x.changes) ? (x.changes as unknown[]).map((ch) => ({ ...(ch as object) })) : x.changes }));
  return {
    users: clone(DEMO_USERS),
    contacts: clone(DEMO_CONTACTS),
    activities: clone(DEMO_ACTIVITIES),
    reactions: clone(DEMO_REACTIONS),
    contact_logs: clone(DEMO_CONTACT_LOGS),
  };
}
