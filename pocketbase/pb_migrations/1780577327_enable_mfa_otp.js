/// <reference path="../pb_data/types.d.ts" />

// Enforce MFA for all employees on the users auth collection.
//
// With mfa.enabled and an empty rule, every sign-in (password or Google OAuth)
// requires a second, different auth method. We enable email OTP as that second
// factor: password → 401 + mfaId → requestOTP → authWithOTP(otpId, code, {mfaId}).
//
// NOTE: OTP emails require working mail delivery — configure SMTP in
// Settings → Mail settings on the PocketBase admin UI before rolling this out.

migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")

  users.mfa.enabled = true
  users.mfa.duration = 1800 // seconds an in-progress MFA flow stays valid
  users.mfa.rule = ""       // empty = applies to every user

  users.otp.enabled = true
  users.otp.duration = 300  // OTP valid for 5 minutes
  users.otp.length = 6

  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")

  users.mfa.enabled = false
  users.otp.enabled = false

  app.save(users)
})
