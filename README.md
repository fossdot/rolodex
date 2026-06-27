# Rolodex

A shared relationship tracker for any team, community, or organisation — so the people you collectively know don't disappear when someone leaves.

> Rolodex was originally built by [FOSS United](https://fossunited.org) for its own network, but nothing in it is tied to that context. Any group that runs on relationships — a non-profit, a student club, a conference team, a chamber of commerce, an open-source project — can self-host it as-is. The role and topic tags are configurable (see [Configuring it for your org](#configuring-it-for-your-org)).

---

## Is this a CRM?

Not really — and the difference matters.

A CRM is built to manage a sales pipeline: leads, deals, stages, and revenue. It is owned by a sales team, optimised for closing transactions, and the "relationship" is a means to a sale.

Rolodex is the opposite. It is a **shared institutional memory of the people a group depends on** — speakers, hosts, mentors, sponsors, volunteers, partners. There is no pipeline, no deal stage, no money to close. The goal is not to convert anyone; it is to make sure the organisation never loses track of who it knows and who has shown up for it.

In short: a CRM helps a company sell to customers. Rolodex helps a community remember its people, and recognise the work of those who maintain those relationships.

---

## Why it exists

Most organisations run on relationships. Events happen, partnerships form, and opportunities get unlocked because someone on the team knew the right person and reached out — a speaker, a venue host, a mentor, a sponsor who believed in the mission.

But those relationships usually live in personal phones, chat apps, and email inboxes. When a staff member or volunteer moves on, those connections leave with them. A new joiner doesn't know who to call in a given city. A lead trying to find the right person has no way to see whom the team already knows. The organisation keeps rediscovering the same people — or failing to reach them at all.

There is also rarely a way to recognise the quiet work that sustains a network. When someone brings in a speaker, connects the team with a venue, or helps start a new chapter, that effort is invisible to the organisation. There's nothing to show for it at review time, or when thinking about who is genuinely building the community.

Rolodex fixes both of these things.

---

## What it does

**One shared address book for the whole organisation.**
Every contact anyone on the team adds is visible to everyone internally. Filter by city, expertise, topic, or role. When you need a particular kind of person in a particular place, you search — you don't start from scratch.

**A log of every meaningful interaction.**
When a contact speaks at an event, hosts a meetup, applies for a grant, mentors, or volunteers for anything — that activity is logged against their record. You build a living history of who has engaged with the organisation and how.

**A score that reflects real community work.**
Each team member gets a score based on the contacts they bring in and the activities they log. This is not a vanity metric — it is a proxy for how actively someone is building and maintaining relationships on behalf of the organisation. Admins can see this on the dashboard.

**Data that stays with the organisation.**
Contacts are not exportable from the browser. The database is self-hosted. When someone leaves, their contacts stay. The organisation's network is finally the organisation's network.

---

## Who uses it

| Role | Access |
|---|---|
| Superadmin | Full database access via PocketBase admin panel |
| App Admin | Dashboard with leaderboard, activity feed, and all contacts |
| Member | Add and manage their own contacts; view the full network; log activities |

---

## What a contact looks like

Each person in Rolodex can be tagged with:

- **Roles in your ecosystem** — e.g. speaker, sponsor, meetup host, ambassador, organising volunteer, board expert, mentor, maintainer. These values are configurable for your organisation.
- **Topics** — e.g. technologist, hardware, AV, public policy, AI/ML, government, education, security, devops, design, community, research, legal, finance. Also configurable.
- **Location** — city and country, so you can find the right person for a regional need
- **How you know them** — a note on the relationship origin

Activities logged against a contact might include: proposed a talk, spoke at an event, hosted a meetup, sponsored an event, started a chapter, applied for or received a grant, mentored, judged, volunteered, or connected the team with a venue or sponsor.

---

## Tech stack

| Layer | Technology |
|---|---|
| Database + API | [PocketBase](https://pocketbase.io) — self-hosted, single binary, SQLite |
| Frontend | [SvelteKit](https://kit.svelte.dev) — runs in the browser |
| Styling | Tailwind CSS |
| Deployment | Caddy (reverse proxy, automatic HTTPS) |

Everything runs on a single Linux VPS. There are no third-party services that hold your data. SMTP for login OTP emails is the one external dependency (any provider; the reference setup uses AWS SES, domain-verified).

---

## Security posture

- **MFA enforced** — every login requires an email OTP as a second factor; no one can sign in with just a password
- **Write restrictions** — members can only edit or delete contacts and activities they added; admins can do anything
- **No bulk export from the browser** — data can only be exported from the PocketBase admin panel, which admins access via SSH tunnel only
- **Admin UI off the internet** — the PocketBase admin panel (`/_/`) is blocked at the reverse proxy; access requires an SSH tunnel to the server
- **Forgery blocked at the server** — server-side hooks enforce that `added_by` and `logged_by` always match the authenticated user, regardless of what the browser sends

---

## Configuring it for your org

The role and topic tags ship with sensible defaults but are meant to be changed. They are defined in two places that must stay in sync:

- `frontend/src/lib/constants.ts` — the select-field values shown in the UI (`FU_ROLES`, `TOPICS`, `ACTIVITY_TYPES`, `COUNTRIES`)
- The PocketBase collection schema — edit via the admin panel, or adjust `pocketbase/setup.js` before bootstrapping

Change both together; changing one without the other breaks validation. Branding (the accent colour and name) lives in `frontend/tailwind.config.js` and `frontend/src/app.css`.

---

## Connecting to existing CRM tools

Rolodex has no built-in connectors today, but because it runs on PocketBase, every record is reachable through a standard REST API — which makes one-way or two-way sync with tools like HubSpot, Salesforce, Pipedrive, or Zoho straightforward to build.

The practical options, easiest first:

- **REST API sync** — PocketBase exposes a full REST API (`/api/collections/contacts/records`, same for `activities`). A small scheduled script can pull new or updated records and push them into any CRM that has an API. Auth is a single token from a service account.
- **Server-side webhooks** — PocketBase supports Go/JS hooks (`onRecordAfterCreateSuccess`, `onRecordAfterUpdateSuccess`). Fire an HTTP call to a CRM, a Zapier/Make webhook, or an internal queue whenever a contact or activity changes — so the CRM updates in near real time.
- **No-code middleware** — point Zapier, Make, or n8n at the PocketBase REST endpoints (polling) or at the webhook above. This covers most teams without writing code.
- **CSV bridge** — the PocketBase admin panel exports collections to CSV, which every major CRM can import. Manual, but zero engineering.

A few things to keep in mind when syncing:

- **Map the fields deliberately.** Rolodex's roles, topics, and country are constrained select values (see `frontend/src/lib/constants.ts`). Map these to the CRM's equivalent picklists, or they'll arrive as free text.
- **Pick a system of record.** Decide whether Rolodex or the CRM "owns" a contact to avoid sync loops; the simplest setup is one-way (Rolodex → CRM).
- **Respect the data posture.** Pushing contacts into an external SaaS CRM moves data off the self-hosted server — which is exactly what Rolodex was built to avoid. Sync deliberately, and only the fields you need.

---

## Running locally

**Prerequisites:** Node.js 18+, a PocketBase binary for your platform.

```bash
# 1. Start PocketBase
./pocketbase/pocketbase serve

# 2. Create a superadmin at http://localhost:8090/_/
#    Then bootstrap the schema:
node pocketbase/setup.js <admin-email> <admin-password>

# 3. Start the frontend
cd frontend
npm install
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env`. Set `PUBLIC_PB_URL` if PocketBase is not on the default port.

---

## Deployment

See `deploy/` for a Caddyfile and systemd service files. PocketBase is configured to bind to `127.0.0.1` only — it is never directly internet-facing.

To access the PocketBase admin panel on the server:

```bash
ssh -L 8090:localhost:8090 user@your-vps
# then open http://localhost:8090/_/ in your browser
```
