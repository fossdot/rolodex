/// <reference path="../pb_data/types.d.ts" />

// Point the password-reset email at the frontend's /reset-password/{TOKEN}
// page. The PocketBase default links to the /_/ dashboard, which is blocked
// at the reverse proxy in production (and is superuser-oriented anyway).
//
// {APP_URL} comes from Settings → Application → Application URL — set it to
// https://rolodex.fossunited.org on the server (frontend and API share the
// domain, so the same base works for both).

migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")

  users.resetPasswordTemplate.subject = "Reset your Rolodex password"
  users.resetPasswordTemplate.body = `<p>Hello,</p>
<p>Click on the button below to reset your password.</p>
<p>
  <a class="btn" href="{APP_URL}/reset-password/{TOKEN}" target="_blank" rel="noopener">Reset password</a>
</p>
<p>If you didn't ask to reset your password, you can ignore this email.</p>
<p>
  Thanks,<br/>
  FOSS United Rolodex
</p>`

  app.save(users)
}, (app) => {
  // No-op revert: the previous template is not worth restoring.
})
