# Rolodex

An internal relationship tracker for FOSS United — so the people we know don't disappear when someone leaves.

---

## Is this a CRM?

Not really — and the difference matters.

A CRM is built to manage a sales pipeline: leads, deals, stages, and revenue. It is owned by a sales team, optimised for closing transactions, and the "relationship" is a means to a sale.

Rolodex is the opposite. It is a **shared institutional memory of the people in our community** — speakers, hosts, mentors, sponsors, volunteers. There is no pipeline, no deal stage, no money to close. The goal is not to convert anyone; it is to make sure the organisation never loses track of who it knows and who has shown up for it.

In short: a CRM helps a company sell to customers. Rolodex helps a community remember its people, and recognise the work of those who maintain those relationships.

---

## Why we built this

FOSS United runs on relationships. Every event we host, every grant we open, every hackathon we run — it works because someone on our team knew the right person and reached out. A speaker for IndiaFOSS. A venue host in Lucknow. A mentor for a student FOSS club. A sponsor who believed in what we do.

But those relationships live in personal phones, WhatsApp chats, and email inboxes. When a staff member or volunteer moves on, those connections go with them — sometimes unintentionally, sometimes not. A new joiner doesn't know who to call in Pune. A director trying to find a judge for a grant review has no way to see whom the team already knows. We keep rediscovering the same people, or worse, failing to reach them at all.

We also have no way to recognise the quiet work that sustains our network. When someone brings in a speaker, connects us with a venue, or helps a student start a FOSS club — that effort is invisible to the organisation. There is nothing to show for it when appraisals come around or when we think about who is genuinely building the community.

Rolodex fixes both of these things.

---

## What it does

**One shared address book for the whole organisation.**
Every contact anyone on the team adds is visible to everyone internally. Filter by city, expertise, topic, or role in the FOSS ecosystem. When we need a speaker in Hyderabad or a hardware expert for a panel, we search — we don't start from scratch.

**A log of every meaningful interaction.**
When a contact speaks at an event, hosts a meetup, applies for a grant, mentors at a hackathon, or volunteers for anything — that activity is logged against their record. We build a living history of who has engaged with FOSS United and how.

**A score that reflects real community work.**
Each staff member gets a score based on the contacts they bring in and the activities they log. This is not a vanity metric — it is a proxy for how actively someone is building and maintaining relationships on behalf of the organisation. Directors can see this on the admin dashboard.

**Data that stays with the organisation.**
Contacts are not exportable from the browser. The database is self-hosted. When someone leaves, their contacts stay. The organisation's network is finally the organisation's network.

---

## Who uses it

| Role | Access |
|---|---|
| Superadmin | Full database access via PocketBase admin panel |
| App Admin | Dashboard with leaderboard, activity feed, and all contacts |
| Staff | Add and manage their own contacts; view the full network; log activities |

---

## What a contact looks like

Each person in Rolodex can be tagged with:

- **Roles in FOSS United's ecosystem** — speaker, sponsor, meetup host, FOSS club ambassador (student or staff), organising volunteer, governing board expert, mentor, project maintainer, and more
- **Topics** — technologist, hardware, AV, public policy, AI/ML, government, open source, education, security, devops, design, community, research, legal, finance
- **Location** — city and country, so we can find the right person for a regional need
- **How we know them** — a note on the relationship origin

Activities logged against a contact might include: proposed a talk, spoke at IndiaFOSS, hosted a city meetup, sponsored an event, established a FOSS club, applied for or received a FOSS grant, mentored at a hackathon, judged a project, reviewed a grant, volunteered, connected us with a venue or sponsor.

---

## Tech stack

| Layer | Technology |
|---|---|
| Database + API | [PocketBase](https://pocketbase.io) — self-hosted, single binary, SQLite |
| Frontend | [SvelteKit](https://kit.svelte.dev) — server-rendered, runs in the browser |
| Styling | Tailwind CSS |
| Deployment | Caddy (reverse proxy, automatic HTTPS) |

Everything runs on a single Linux VPS. There are no third-party services that hold our data. SMTP for login OTP emails is the one external dependency (AWS SES, domain-verified).

---

## Security posture

- **MFA enforced** — every login requires an email OTP as a second factor; no one can sign in with just a password
- **Write restrictions** — staff can only edit or delete contacts and activities they added; admins can do anything
- **No bulk export from the browser** — data can only be exported from the PocketBase admin panel, which directors access via SSH tunnel only
- **Admin UI off the internet** — the PocketBase admin panel (`/_/`) is blocked at the reverse proxy; access requires an SSH tunnel to the server
- **Forgery blocked at the server** — server-side hooks enforce that `added_by` and `logged_by` always match the authenticated user, regardless of what the browser sends

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
