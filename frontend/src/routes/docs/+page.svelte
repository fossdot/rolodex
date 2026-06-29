<script lang="ts">
  import { base } from '$app/paths';

  const sections = [
    ['overview', 'What is Rolodex'],
    ['signing-in', 'Signing in'],
    ['navigation', 'Finding your way around'],
    ['contacts', 'Contacts'],
    ['import', 'Importing contacts'],
    ['activities', 'Activities'],
    ['reminders', 'Reach-out reminders'],
    ['organisations', 'Organisations'],
    ['views', 'My Contacts vs Rolodex'],
    ['admin', 'Admin & scoring'],
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
          <li><strong>Multiple values:</strong> separate roles/topics with a pipe — e.g. <code>Speaker | Mentor</code>.</li>
        </ul>
      </section>

      <section id="activities">
        <h2>Activities</h2>
        <p>
          Activities are the interactions you log against a contact — a talk they gave, a call, a sponsorship, an
          intro you made. They build a shared history of the relationship.
        </p>
        <h3>Logging an activity</h3>
        <p>
          On a contact, click <strong>Log Activity</strong>. Pick a type, add the event/context, a date, and notes.
          You can attach a follow-up reminder at the same time. Anyone can log activities on any contact —
          engagement is shared.
        </p>
        <h3>Reactions &amp; the feed</h3>
        <ul>
          <li>React to any activity with an emoji, WhatsApp-style.</li>
          <li>The <strong>Activities</strong> page shows interactions across the whole network, filterable by <strong>this week / month / quarter / year</strong> or a custom range.</li>
        </ul>
        <p class="note">Activities are a permanent record — once logged they can't be edited or deleted.</p>
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
