/// <reference path="../pb_data/types.d.ts" />
// The invite flow sends the built-in password-reset email, so its wording has to
// work for someone who has never had an account as well as for someone who
// forgot their password. "Reset your password" read as a warning to a new
// member who never asked for anything.
migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")

  users.resetPasswordTemplate.subject = "Set your Rolodex password"
  users.resetPasswordTemplate.body = `<p>Hello,</p>
<p>Use the button below to set a password for your FOSS United Rolodex account.</p>
<p>
  <a class="btn" href="{APP_URL}/reset-password/{TOKEN}" target="_blank" rel="noopener">Set password</a>
</p>
<p>If you weren't expecting this, you can ignore this email — nothing changes until you set a password.</p>
<p>
  Thanks,<br/>
  FOSS United Rolodex
</p>`

  app.save(users)
}, (app) => {
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
})
