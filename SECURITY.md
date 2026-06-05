# Security

How Rolodex protects FOSS United's network data — who can get in, what they can touch, and what can never be silently changed.

The data in this system is the organisation's relationship graph: names, personal emails, phone numbers, and notes about how we know people. Treating it carelessly would harm real people who trusted us with their details. Security here is layered: every protection below is enforced **on the server** — the browser UI is convenience, never the boundary.

---

## 1. Keeping attackers out

### Network surface

| Surface | Exposure |
|---|---|
| `https://rolodex.fossunited.org` | The only public entry point. HTTPS via Caddy + Let's Encrypt; HTTP redirects to HTTPS. |
| PocketBase (database + API) | Bound to `127.0.0.1:8090` — never directly reachable from the internet. Caddy proxies only `/api/*` to it. |
| PocketBase superadmin panel (`/_/`) | **Blocked at the reverse proxy (403).** The only way in is an SSH tunnel to the server (`ssh -L`), which requires the server's SSH key. |
| Server (Linode VPS) | UFW firewall allows only SSH (22), HTTP (80), HTTPS (443). SSH uses key authentication. |

### Authentication — three independent gates

1. **Domain restriction.** Only `@fossunited.org` accounts can sign in — enforced server-side in hooks on *password login*, *Google sign-in*, and *account creation* (so a non-org account cannot even be created by mistake). The Google OAuth consent screen is additionally set to **Internal**, so Google itself rejects outside accounts before our code runs.
2. **Multi-factor authentication.** Every fresh login — password *or* Google — requires a 6-digit one-time code emailed to the user (PocketBase MFA, codes expire in 5 minutes). A stolen password alone is not enough; the attacker would also need the victim's mailbox.
3. **No account enumeration.** The password-reset form responds identically whether or not an account exists. Reset links go to our own `/reset-password` page (the superadmin panel they would otherwise point to is blocked in production).

Sessions are short-lived JWTs (~2 weeks); on every page load the auth record is re-fetched so a role change or account removal takes effect immediately, not when the old token expires.

---

## 2. Stopping data manipulation

All access-control rules live in the PocketBase collection schema and are evaluated server-side on every request. The frontend repeats some checks for friendly UX, but bypassing the frontend bypasses nothing.

### Who can do what

| Action | Rule (server-enforced) |
|---|---|
| Read contacts / activities / reactions | Any authenticated staff member |
| Create a contact or activity | Any authenticated employee |
| Edit a contact | Only the person who added it, or an admin |
| Delete (soft) a contact | Only the owner or an admin |
| Edit or delete an **activity** | **Nobody** — see immutability below |
| List user accounts | Admins only |
| Remove a reaction | Only the person who made it |

### Anti-forgery hooks

Server-side hooks rewrite security-critical fields regardless of what the client sends:

- `added_by` on contacts and `logged_by` on activities are **forced to the authenticated user**. You cannot attribute work to someone else, and since the engagement score is `contacts × 1 + activities × 2`, this is also what prevents **score gaming** — the leaderboard can only be climbed by doing the work under your own name.
- `added_by` is **locked on update** — ownership of a contact can never be reassigned through the API.
- Reactions are forced to the reacting user, capped at one per person per activity (unique database index), and only removable by their author.
- Validation that the schema can't express (e.g. "if role is *Other*, the description is required") is enforced in hooks, so it can't be skipped by calling the API directly.

---

## 3. Data immutability and audit trail

**Activities are append-only.** Once logged, an activity can never be edited or deleted through the API by anyone — including admins (`updateRule` and `deleteRule` are null). The history of who engaged whom is the organisation's institutional memory; it cannot be quietly rewritten.

**Deletes are soft.** "Deleting" a contact sets `deleted_at`/`deleted_by` — nothing is destroyed. Deleted records:
- disappear for employees (filtered out by the read rules, not just hidden in the UI),
- remain visible to admins, with **who deleted it and when**,
- can be restored only by an admin or superadmin (enforced in a hook).

Every record carries server-managed `created`/`updated` timestamps, and PocketBase keeps request logs (method, path, auth identity, IP) for incident review.

---

## 4. Preventing data exfiltration

The whole point of Rolodex is that the network belongs to the organisation — so getting the whole network *out* is deliberately hard:

- **No bulk export in the app.** No CSV/Excel button, no export endpoint. The API serves paginated, authenticated reads only.
- **Full database access requires the superadmin panel**, which is unreachable from the internet (SSH tunnel + superadmin credentials — directors only).
- **Contact photos** are served through PocketBase's file API; uploads are restricted to image types with a 5 MB cap, so the file field can't be abused to smuggle arbitrary content.
- The one external service is AWS SES, used solely to *send* OTP and reset emails — no contact data leaves the server.

This does not stop a determined insider from copying records they can legitimately read one page at a time — no system can — but it removes the one-click "walk away with everything" path, and every account that can read data is a named, MFA-protected `@fossunited.org` identity.

---

## 5. Code and infrastructure hygiene

- The repository is private; the production server pulls via a fine-grained GitHub token scoped to read-only on this single repo.
- Secrets are never committed: `pb_data/` (the live database), `.env` files, and local tool configuration are gitignored.
- Schema changes ship as versioned migrations in git — the database's rules are reviewable code, not dashboard clicks.
- The frontend talks to PocketBase with the signed-in user's own token. There is no shared service account whose compromise would expose everything.

---

## 6. Known gaps and planned hardening

Being honest about what this system does *not* yet do:

| Gap | Status |
|---|---|
| **Automated off-site backups** of `pb_data/` | Not yet configured — highest-priority next step |
| Rate limiting / brute-force lockout beyond PocketBase defaults | Not tuned; MFA limits the impact |
| Encryption at rest for the SQLite database | Not enabled; mitigated by disk-level VPS access controls |
| Automatic OS security updates on the VPS | Manual for now |
| GitHub deploy token rotation | Expires ~Sept 2026; plan to replace with a read-only deploy key |

---

## Reporting a security issue

If you find a vulnerability, email **vishal@fossunited.org** directly. Please do not open a public GitHub issue for security reports.
