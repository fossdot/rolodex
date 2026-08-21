<script lang="ts">
  import { base } from '$app/paths';

  const sections = [
    ['overview', 'What is Rolodex'],
    ['signing-in', 'Signing in'],
    ['navigation', 'Finding your way around'],
    ['contacts', 'Contacts'],
    ['import', 'Importing contacts'],
    ['multiple-values', 'Entering several values'],
    ['activities', 'Activities'],
    ['reminders', 'Reach-out reminders'],
    ['organisations', 'Organisations'],
    ['views', 'My Contacts vs Rolodex'],
    ['admin', 'Admin & scoring'],
    ['team', 'Team & access'],
    ['tips', 'Tips & shortcuts'],
  ];
</script>

<svelte:head>
  <title>Docs · Rolodex</title>
</svelte:head>

<!-- Prose styles scoped to the docs article: gives the "documentation" feel
     (readable measure, generous spacing, clear hierarchy) without the app's
     compact card UI. -->
<div class="px-6 py-10 lg:py-14 max-w-5xl mx-auto">
  <div class="lg:flex lg:gap-12">
    <article class="doc min-w-0 flex-1 lg:max-w-2xl">
      <header class="mb-10">
        <p class="text-xs font-semibold uppercase tracking-widest text-accent dark:text-accent-dark">Rolodex</p>
        <h1 class="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mt-1.5">Documentation</h1>
        <p class="text-base text-neutral-500 dark:text-neutral-400 mt-2">A guide to using Rolodex — the team's shared contact network.</p>
      </header>

      <section id="overview">
        <h2>What is Rolodex</h2>
        <p>
          Rolodex is a lightweight CRM for keeping track of the people in our community and the interactions we
          have with them. Everyone on the team can see the whole network, add contacts, and log activities. It's
          deliberately simple: <strong>contacts</strong>, the <strong>activities</strong> logged against them, and
          <strong>reminders</strong> to follow up.
        </p>
      </section>

      <section id="signing-in">
        <h2>Signing in</h2>
        <p>
          Sign in with your organisation Google account, or with email and password. Access is restricted to
          approved organisation email addresses — personal accounts can't sign in. There are two roles:
          <strong>employee</strong> (the default) and <strong>admin</strong>.
        </p>
      </section>

      <section id="navigation">
        <h2>Finding your way around</h2>
        <p>The sidebar is your map:</p>
        <ul>
          <li><strong>My Contacts</strong> — the contacts you added.</li>
          <li><strong>Rolodex</strong> — every contact in the network (the whole team's).</li>
          <li><strong>Log Activity</strong> — log one interaction covering everyone who was involved.</li>
          <li><strong>Organisations</strong> — contacts grouped by organisation.</li>
          <li><strong>Activities</strong> — a feed of all logged interactions, with time filters.</li>
          <li><strong>Admin</strong> — a team dashboard (admins only).</li>
          <li><strong>🔔 Bell</strong> (top of the sidebar) — your reach-out reminders.</li>
        </ul>
      </section>

      <section id="contacts">
        <h2>Contacts</h2>
        <h3>Adding a contact</h3>
        <p>
          Click <strong>Add Contact</strong> (or press <kbd>n</kbd>). At minimum, give a
          <strong>Name or Organisation</strong> and an <strong>Email or Mobile</strong>, and say how you know them.
          Then pick:
        </p>
        <ul>
          <li><strong>Roles</strong> — how the person can be involved (speaker, sponsor, mentor, volunteer, and more).</li>
          <li><strong>Topics</strong> — their areas of interest or expertise.</li>
        </ul>
        <p>You can also add a photo, LinkedIn, location, and secondary contact details.</p>

        <h3>Viewing &amp; editing</h3>
        <p>
          Open a contact to see their details, the activity timeline, and an edit history of who changed what.
          Click <strong>Edit</strong> to update — every signed-in teammate can edit, and changes are recorded.
        </p>

        <h3>Deleting</h3>
        <p>
          Deletes are <strong>soft</strong> — a deleted contact is hidden, not erased, so anything removed by
          mistake can be recovered.
        </p>
      </section>

      <section id="import">
        <h2>Importing contacts</h2>
        <p>
          Use <strong>Import Contacts</strong> (sidebar footer) to bulk-add from a CSV. Download the template, add
          one contact per row, and upload. Rolodex previews the rows and flags problems before anything is saved —
          and suggests corrections (“did you mean?”) for misspelled column headers or role/topic values.
        </p>
        <ul>
          <li><strong>Required per row:</strong> a Name or Organisation, an Email or Mobile, how you know them, and at least one role and one topic.</li>
          <li><strong>Multiple values:</strong> separate them with a pipe — e.g. <code>Speaker | Mentor</code>, or <code>IIT Bombay | GNOME Foundation</code> in the <code>org</code> column.</li>
        </ul>
      </section>

      <section id="multiple-values">
        <h2>Entering several values</h2>
        <p>
          A few fields hold more than one value, and they don't all work the same way. In short: in a CSV it's
          always a pipe; in the app it's a comma or a pick-list.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Where</th><th>Field</th><th>How to add several</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Contact form</td>
                <td>Organisation</td>
                <td>Type a name and press <kbd>Enter</kbd>, or pick a suggestion. Commas also work, so pasting <code>IIT Bombay, GNOME Foundation</code> adds both. Each gets its own row; the first is the primary.</td>
              </tr>
              <tr>
                <td>Contact form</td>
                <td>FOSS United roles · Topics</td>
                <td>Tick as many boxes as apply.</td>
              </tr>
              <tr>
                <td>Log Activity</td>
                <td>Contacts involved</td>
                <td>Search and pick each person. Not in the Rolodex yet? Choose <strong>“Add … as a new contact”</strong>. Each chip has its own role dropdown.</td>
              </tr>
              <tr>
                <td>Contact form</td>
                <td>Designation per organisation</td>
                <td>One box per organisation row — fill in only the ones you know.</td>
              </tr>
              <tr>
                <td>Reminder CC</td>
                <td>Teammates</td>
                <td>Tick as many as you like.</td>
              </tr>
              <tr>
                <td>Reminder CC</td>
                <td>Other addresses</td>
                <td>Comma-separated — <code>team@fossunited.org, community@fossunited.org</code>.</td>
              </tr>
              <tr>
                <td>CSV import</td>
                <td><code>org</code> · <code>fu_roles</code> · <code>topics</code></td>
                <td>Pipe-separated — <code>Speaker | Mentor</code>. A comma would be read as a new CSV column.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">
          Why the pipe in CSVs? Commas already separate columns there, so an organisation named
          <code>Acme, Inc</code> would otherwise split into two.
        </p>
      </section>

      <section id="activities">
        <h2>Activities</h2>
        <p>
          Activities are the interactions you log against a contact — a talk they gave, a call, a sponsorship, an
          intro you made. They build a shared history of the relationship.
        </p>
        <h3>Logging an activity</h3>
        <p>There are two ways in, and both write the same entry:</p>
        <ul>
          <li>
            <strong>Log Activity</strong> in the sidebar — for anything involving more than one person. Search the
            Rolodex and add everyone who was there, then fill in the activity once. One entry, shown on every
            participant's timeline.
          </li>
          <li>
            <strong>Log Activity</strong> on a contact's page — the quick path when it only concerns them.
          </li>
        </ul>
        <p>
          Either way: pick a type, add the event/context, a date, and notes, and optionally attach a follow-up
          reminder at the same time. Anyone can log activities on any contact — engagement is shared.
        </p>
        <p>
          Someone not in the Rolodex yet? Search for them in the contacts box and choose
          <strong>“Add … as a new contact”</strong> — you can create them inline, without losing the activity
          you're part-way through.
        </p>
        <p class="note">
          A shared activity counts once for each person on it, so it shows on all their timelines and in each of
          their activity counts.
        </p>

        <h3>Who did what</h3>
        <p>
          Each participant can carry a <strong>role</strong> for that activity — one person spoke, another
          sponsored, a third volunteered. Pick it from the dropdown on their chip while logging (or from the
          <strong>Their role</strong> box when logging against a single contact). It's optional; left blank,
          nothing is recorded.
        </p>
        <p>Once set, the role shows up wherever the activity appears:</p>
        <ul>
          <li>On the contact's own timeline as a badge beside the activity — <span class="badge-green">Speaker</span></li>
          <li>In the list of other participants on that activity — <em>with Dev Kumar, Rohit Desai</em></li>
          <li>In the activity feed and on the organisation page — <em>Ananya Sharma (Speaker), Dev Kumar (Sponsor)</em></li>
        </ul>
        <p>
          Tagged the wrong person? Open the activity's <strong>✎</strong> and change or clear any role there — no
          need to delete and re-log.
        </p>
        <p class="note">
          Roles are labels for context, not a filter: searching “sponsor” won't return every sponsor. The available
          roles are Speaker, Organiser, Volunteer, Sponsor, Attendee, Mentor, Judge, Maintainer, Host and Other.
        </p>
        <h3>Sharing a link to an activity</h3>
        <p>
          Want a colleague to read one particular activity — the notes from a meeting you just logged, say? Click
          the <strong>🔗</strong> beside it and the link is copied, ready to paste into Mattermost or an email.
          Opening it takes them to that contact's page with the activity scrolled into view and highlighted for a
          moment.
        </p>
        <p>
          Anyone with a Rolodex login can open it, whether or not they logged the activity themselves. If they
          aren't signed in yet they'll land back on the activity after signing in, rather than on the contacts
          list.
        </p>
        <p class="note">
          An activity that covers several people sits on each of their timelines, so copy the link from whichever
          contact you want the reader to land on. Links reach the 100 most recent activities on a timeline; older
          ones open the contact page with nothing highlighted, as does a link to an activity someone has since
          deleted.
        </p>
        <h3>Fixing a mistake</h3>
        <p>
          Made a typo or logged the wrong date? Click the <strong>✎</strong> on an activity to edit it — including
          who was involved, if you missed someone or added them by accident. Only the person who logged it — or an
          admin — can, and a corrected activity is marked <strong>edited</strong> so the history stays honest.
        </p>
        <h3>Deleting an activity</h3>
        <p>
          Logged something twice, or in the wrong place? Click the <strong>🗑</strong> on an activity. It then
          disappears from Rolodex <em>entirely</em> — for everyone, admins included. Only the person who logged it,
          or an admin, can delete.
        </p>
        <p>
          Nothing is actually erased: the record stays in the database with a note of who deleted it and when. If a
          delete was a mistake, an admin can recover it from the PocketBase dashboard — it isn't undoable from
          inside Rolodex.
        </p>
        <p class="note">
          Deleting an activity also cancels any pending follow-up reminders on it, so nobody gets nudged about
          something that no longer exists. (Contacts behave differently — a deleted <em>contact</em> is still
          visible to admins and restorable in the app.)
        </p>
        <h3>Reactions &amp; the feed</h3>
        <ul>
          <li>React to any activity with an emoji, WhatsApp-style.</li>
          <li>The <strong>Activities</strong> page shows interactions across the whole network, filterable by <strong>this week / month / quarter / year</strong> or a custom range.</li>
        </ul>
        <p class="note">Nothing is ever really erased — a deleted activity stays recoverable by an admin, so the shared history holds.</p>
      </section>

      <section id="reminders">
        <h2>Reach-out reminders</h2>
        <p>
          A reminder is a follow-up attached to an <strong>activity</strong>, so you never lose track of who to
          circle back to. At the time you choose, Rolodex emails you (or a teammate) a nudge that includes the
          activity and the contact's details.
        </p>
        <h3>Setting one</h3>
        <p>Reminders live on activities, so open a contact and either:</p>
        <ul>
          <li>while logging an activity, expand <strong>“Add a follow-up reminder”</strong>, or</li>
          <li>on an existing activity, click <strong>“Add follow-up reminder”</strong>.</li>
        </ul>
        <p>
          Pick the <strong>date and time</strong> (IST — defaults to 10:00 AM) and who to <strong>notify</strong>
          (defaults to you). If a contact has no activities yet, log one first.
        </p>
        <h3>Copying other people in</h3>
        <p>
          Expand <strong>Add CC</strong> to copy others on the email. Tick any teammates, and use
          <strong>Other addresses</strong> for anyone outside Rolodex — a Google group, say, or a partner without
          an account. Separate several with commas.
        </p>
        <p class="note">
          CC is an emailed copy only: the reminder still belongs to its single assignee, so it stays in their bell
          and not everyone else's.
        </p>
        <h3>Where they show &amp; what's in the email</h3>
        <ul>
          <li>On the activity as a chip — <span class="badge-green">🔔 Follow up · date</span> — which flips to <span class="text-neutral-500 dark:text-neutral-400">✓ Reminded · date</span> after it fires.</li>
          <li>In the <strong>bell</strong> (top of the sidebar): your <strong>Upcoming</strong> and <strong>Sent</strong> reminders, with a badge for pending ones.</li>
          <li>The email includes the activity (and its notes), the contact's details, and a link straight to the contact.</li>
        </ul>
        <p class="note">Reminders are personal (only you see your own) and fire once — set a new follow-up anytime for another nudge.</p>
      </section>

      <section id="organisations">
        <h2>Organisations</h2>
        <p>
          The <strong>Organisations</strong> page groups contacts by their organisation, so you can see everyone
          you know at a given company or community in one place. Clicking an organisation name anywhere in the app
          takes you there.
        </p>
        <h3>A contact can belong to several</h3>
        <p>
          People wear more than one hat — someone might maintain a project, work somewhere else, and volunteer for
          a FOSS United city chapter. Add as many organisations as apply on the contact form; they appear as chips
          you can reorder or remove.
        </p>
        <p>
          The <strong>first</strong> one is their <strong>primary</strong> organisation: it's what shows where
          there's only room for one line — list rows, the activity feed, reminder emails. Their profile page lists
          all of them, and the contact appears under <em>every</em> organisation they belong to.
        </p>
        <p>
          Organisations are shared records, so start typing and pick the existing spelling rather than making a
          near-duplicate. If it's genuinely new, choose <strong>Add “…”</strong> to create it.
        </p>
        <h3>Renaming, and merging duplicates</h3>
        <p>
          Admins can rename an organisation from its own page — the ✎ beside the heading. Because it's one shared
          record, the new name applies to every contact linked to it in a single edit.
        </p>
        <p>
          Two entries for the same place — <code>Acme</code> and <code>Acme, Inc</code>, say — are combined with
          <strong>Merge into another organisation</strong>, just under the heading. Pick the one to keep: every
          contact filed under this organisation moves across (including any per-organisation designation), and the
          empty one is removed.
        </p>
        <p class="note">
          Renaming won't merge anything — organisation names are unique, so renaming onto one that already exists is
          refused. Merge is the tool for that.
        </p>
        <h3>A different title at each one</h3>
        <p>
          Every organisation row has its own optional <strong>designation</strong> box, because a title rarely
          carries across — someone may be a Professor at one, a Maintainer at another, a Volunteer at a third.
          Their profile then reads:
        </p>
        <p class="formula">IIT Bombay — Professor, CSE · GNOME Foundation — Maintainer · Zerodha</p>
        <p>
          The plain <strong>Designation</strong> field near the top stays their headline — one line, shown on its
          own above the organisations. Per-org titles are optional; an organisation with none simply shows its name.
          Changes are recorded in the contact's edit history.
        </p>
        <p class="note">
          Importing by CSV? The <code>org</code> column takes several organisations separated by a pipe —
          <code>IIT Bombay | GNOME Foundation</code> — the same way <code>fu_roles</code> and <code>topics</code> do.
        </p>
      </section>

      <section id="views">
        <h2>My Contacts vs Rolodex</h2>
        <ul>
          <li><strong>My Contacts</strong> shows only the contacts you added — your personal slice.</li>
          <li><strong>Rolodex</strong> shows the entire network — everyone's contacts. Engagement is shared, so you can log activities and set your own reminders on anyone's contact.</li>
        </ul>
      </section>

      <section id="admin">
        <h2>Admin &amp; scoring</h2>
        <p>Admins get a dashboard with team-wide activity and a simple engagement score per person:</p>
        <p class="formula">contacts added × 1 &nbsp;+&nbsp; activities logged × 2 &nbsp;=&nbsp; score</p>
        <p>Admins can also view and restore deleted contacts and activities.</p>

        <h3>The dashboard tiles</h3>
        <p>
          The three numbers at the top are links, not just counts: <strong>Total Contacts</strong> opens the whole
          rolodex, <strong>Activities Logged</strong> opens the activity feed, and <strong>Team Members</strong>
          opens the team screen below.
        </p>
      </section>

      <section id="team">
        <h2>Team &amp; access</h2>
        <p>
          Everything about who can get into Rolodex lives on one screen: <strong>Admin → Team Members →
          Manage the team</strong>. You need to be an admin to open it.
        </p>

        <h3>What each role can do</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>&nbsp;</th><th>Employee</th><th>Admin</th></tr>
            </thead>
            <tbody>
              <tr><td>Add contacts, log activities, set reminders</td><td>Yes</td><td>Yes</td></tr>
              <tr><td>See every contact in the network</td><td>Yes</td><td>Yes</td></tr>
              <tr><td>Edit or delete an activity</td><td>Only ones they logged</td><td>Any</td></tr>
              <tr><td>Edit or delete a contact</td><td>Only ones they added</td><td>Any</td></tr>
              <tr><td>Dashboard, scores, deleted contacts</td><td>No</td><td>Yes</td></tr>
              <tr><td>Invite people, change roles, remove access</td><td>No</td><td>Yes</td></tr>
            </tbody>
          </table>
        </div>

        <h3>Inviting someone</h3>
        <p>
          Press <strong>Invite a teammate</strong>, enter their <code>@fossunited.org</code> address and choose a
          role. Rolodex creates the account and emails them a link to set their own password — you never see or
          choose it, and nothing in the rolodex is reachable until they do.
        </p>
        <p>
          Only admins can create accounts. Nobody can sign themselves up, even with a work address.
        </p>
        <p class="note">
          If the invite email doesn't send, the message says so — the account still exists, so don't send the invite
          twice. Use <strong>Password link</strong> on their row to try the email again.
        </p>

        <h3>Changing someone's role</h3>
        <p>
          Pick Admin or Employee from the dropdown on their row; it takes effect the next time their app loads.
          Two rules are enforced no matter what:
        </p>
        <ul>
          <li><strong>You can't change your own role or access.</strong> Ask another admin — which is also how an admin steps down: they promote a colleague, and that colleague demotes them.</li>
          <li><strong>The last active admin can't be removed or demoted.</strong> There is always someone who can manage the team, so nobody can lock everyone out by accident.</li>
        </ul>

        <h3>When someone leaves</h3>
        <p>
          Use <strong>Remove</strong> on their row. It stops them signing in, and the app signs them out the next
          time it loads for them. Their row stays on the screen marked <strong>no access</strong>, and
          <strong>Restore</strong> puts them back.
        </p>
        <p>
          <strong>Nothing they contributed is touched.</strong> Every contact still reads "Added by" their name,
          every activity still says who logged it, and their score stays on the dashboard. That is the point of
          removing access rather than deleting the account: deleting would blank their name everywhere, and the
          organisation would lose the record of who built those relationships.
        </p>
        <p class="note">
          For an ordinary departure this is all you need. If an account has actually been compromised, tell whoever
          runs the server as well — removing access closes the app immediately, but a stolen sign-in token can keep
          working against the raw API until it expires, and only a server admin can cut that short.
        </p>

        <h3>Someone locked out</h3>
        <p>
          <strong>Password link</strong> on their row emails them a link to set a new password. They can also do it
          themselves with <strong>Forgot password?</strong> on the sign-in page — the button is for when they can't
          receive that, or aren't sure they still have an account.
        </p>
        <p class="note">
          You won't see other people's email addresses on this screen, only your own. That is deliberate: the roster
          shows names and roles, and the password button looks the address up without putting everyone's inbox in
          front of every colleague. Invited accounts also show as unverified in the server dashboard — harmless,
          nothing in Rolodex requires verification.
        </p>
      </section>

      <section id="tips">
        <h2>Tips &amp; shortcuts</h2>
        <ul>
          <li><strong>Search</strong>: press <kbd>/</kbd> or <kbd>⌘/Ctrl K</kbd> to jump to search. It matches name, org, email, city, and activity notes.</li>
          <li><strong>New contact</strong>: press <kbd>n</kbd>.</li>
          <li><strong>All shortcuts</strong>: press <kbd>?</kbd>.</li>
          <li><strong>Dark mode</strong>: toggle in the sidebar footer — it's remembered on this device.</li>
        </ul>
      </section>

      <p class="text-sm text-neutral-400 dark:text-neutral-500 mt-14 pt-6 border-t border-neutral-100 dark:border-neutral-800">
        Questions or something missing? Ping the team. <a href="{base}/contacts" class="text-accent dark:text-accent-dark hover:underline">Back to contacts →</a>
      </p>
    </article>

    <!-- On this page -->
    <aside class="hidden lg:block w-48 shrink-0">
      <div class="sticky top-14">
        <p class="text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">On this page</p>
        <ul class="border-l border-neutral-200 dark:border-neutral-800">
          {#each sections as [id, label]}
            <li>
              <a href="#{id}" class="block py-1.5 pl-4 -ml-px border-l border-transparent text-sm text-neutral-500 dark:text-neutral-400 hover:border-accent dark:hover:border-accent-dark hover:text-accent dark:hover:text-accent-dark transition-colors">
                {label}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </aside>
  </div>
</div>

<style>
  /* Documentation prose — readable measure + clear hierarchy. */
  .doc :global(h2) {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-top: 2.75rem;
    margin-bottom: 0.75rem;
    scroll-margin-top: 2rem;
    color: rgb(23 23 23);
  }
  :global(.dark) .doc :global(h2) { color: rgb(245 245 245); }
  .doc :global(h2):first-of-type,
  .doc :global(section):first-child :global(h2) { margin-top: 0; }

  .doc :global(h3) {
    font-size: 1rem;
    font-weight: 600;
    margin-top: 1.75rem;
    margin-bottom: 0.4rem;
    color: rgb(38 38 38);
  }
  :global(.dark) .doc :global(h3) { color: rgb(229 229 229); }

  .doc :global(p) {
    font-size: 0.95rem;
    line-height: 1.7;
    color: rgb(64 64 64);
    margin: 0.6rem 0;
  }
  :global(.dark) .doc :global(p) { color: rgb(212 212 212); }

  .doc :global(ul) {
    list-style: disc;
    padding-left: 1.25rem;
    margin: 0.6rem 0;
  }
  .doc :global(li) {
    font-size: 0.95rem;
    line-height: 1.65;
    color: rgb(64 64 64);
    margin: 0.3rem 0;
  }
  :global(.dark) .doc :global(li) { color: rgb(212 212 212); }

  .doc :global(section) { margin-bottom: 0.5rem; }

  .doc :global(kbd) {
    font-size: 0.75rem;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
    background: rgb(245 245 245);
    border: 1px solid rgb(229 229 229);
    color: rgb(82 82 82);
    font-family: ui-monospace, monospace;
  }
  :global(.dark) .doc :global(kbd) {
    background: rgb(38 38 38);
    border-color: rgb(64 64 64);
    color: rgb(212 212 212);
  }

  .doc :global(code) {
    font-size: 0.825rem;
    padding: 0.1rem 0.35rem;
    border-radius: 0.25rem;
    background: rgb(245 245 245);
    font-family: ui-monospace, monospace;
  }
  :global(.dark) .doc :global(code) { background: rgb(38 38 38); }

  .doc :global(.note) {
    font-size: 0.85rem;
    color: rgb(115 115 115);
    border-left: 2px solid rgb(212 212 212);
    padding-left: 0.85rem;
    margin-top: 0.85rem;
  }
  :global(.dark) .doc :global(.note) { color: rgb(163 163 163); border-color: rgb(64 64 64); }

  /* Wide tables scroll inside their own box rather than widening the page. */
  .doc :global(.table-wrap) {
    overflow-x: auto;
    margin: 0.85rem 0;
    border: 1px solid rgb(229 229 229);
    border-radius: 0.5rem;
  }
  :global(.dark) .doc :global(.table-wrap) { border-color: rgb(38 38 38); }

  .doc :global(table) {
    width: 100%;
    min-width: 34rem;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .doc :global(th),
  .doc :global(td) {
    text-align: left;
    vertical-align: top;
    padding: 0.6rem 0.85rem;
    border-bottom: 1px solid rgb(240 240 240);
  }
  .doc :global(tbody tr:last-child th),
  .doc :global(tbody tr:last-child td) { border-bottom: 0; }
  .doc :global(th) {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgb(115 115 115);
    background: rgb(250 250 250);
    white-space: nowrap;
  }
  .doc :global(td:nth-child(1)),
  .doc :global(td:nth-child(2)) { white-space: nowrap; color: rgb(64 64 64); }
  :global(.dark) .doc :global(th),
  :global(.dark) .doc :global(td) { border-color: rgb(38 38 38); }
  :global(.dark) .doc :global(th) { color: rgb(163 163 163); background: rgb(23 23 23); }
  :global(.dark) .doc :global(td:nth-child(1)),
  :global(.dark) .doc :global(td:nth-child(2)) { color: rgb(212 212 212); }

  .doc :global(kbd) {
    font-size: 0.7rem;
    padding: 0.1rem 0.3rem;
    border: 1px solid rgb(229 229 229);
    border-radius: 0.25rem;
    background: rgb(250 250 250);
    font-family: ui-monospace, monospace;
  }
  :global(.dark) .doc :global(kbd) { border-color: rgb(64 64 64); background: rgb(38 38 38); }

  .doc :global(.formula) {
    font-weight: 600;
    color: rgb(23 23 23);
    background: rgb(250 250 250);
    border: 1px solid rgb(229 229 229);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
  }
  :global(.dark) .doc :global(.formula) {
    color: rgb(245 245 245);
    background: rgb(23 23 23);
    border-color: rgb(38 38 38);
  }
</style>
