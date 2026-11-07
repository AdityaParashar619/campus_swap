# Security Decisions

## Identity and account state

- Student registration requires syntactically valid email and an exact match to `ALLOWED_COLLEGE_DOMAINS`; production registration fails closed when the allow-list is empty. This proves control of the configured college mailbox, not enrollment-record authenticity. No institutional domain or enrollment pattern is assumed by this repository.
- Optional enrollment regex, department, branch, and semester lists are controlled through backend environment configuration.
- Student OTPs use a six digit cryptographically random code, HMAC hash with `OTP_PEPPER`, ten minute expiry, maximum five attempts, and a one minute resend cooldown. Resending replaces the prior hash. Mock delivery is local-only and rejected in production.
- Alumni registrations verify their personal email through the configured provider and remain pending until a permitted reviewer separately approves them.
- Existing users without the new state fields remain active for backward compatibility unless their legacy blocked flag is set. New student registrations cannot authenticate before verification.

## Sessions

- Passwords continue to use bcrypt hashes in the existing `password` field to avoid a destructive migration. Password policy for new/replacement passwords is 12–128 characters.
- Access JWT lifetime defaults to 15 minutes. Web access tokens live in JavaScript memory; the 30 day refresh token is opaque, stored as SHA-256 hash server-side, and set in an HttpOnly cookie.
- Refresh rotation atomically revokes the submitted session before minting its replacement. Reuse of a revoked token revokes active sessions in the same family.
- Logout, password reset/change, role change, suspension, and block revoke refresh sessions. Access token `tokenVersion` is checked against the user record.
- Cookie refresh/logout requires an allow-listed Origin when present. Production cross-site cookie use requires HTTPS (`Secure`, `SameSite=None`) and correct CORS credentials configuration.
- Native clients should call login, hold short-lived access tokens in platform secure storage, send them as bearer tokens, and use a future explicit native refresh transport. Native refresh-token transport is not implemented in this browser phase.

## Authorization and audit

- A central role-permission map backs reusable backend middleware. Frontend role guards improve navigation only and are not the security boundary.
- Department and club coordinator assignments require a configured department/club scope. Future scoped endpoints must compare that scope to the requested resource; the field alone does not impose resource filtering.
- Ordinary profile updates accept only existing public profile fields; role, enrollment, account status, and verification fields are not accepted.
- College administrators cannot assign `admin` or `super_admin`; only a super administrator can assign those elevated roles. Self-role/status changes are denied.
- The legacy `ADMIN_EMAIL` bootstrap role retains the existing moderation dashboard and block action, but cannot manage IAM roles or review alumni verifications. Use a dedicated `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` to bootstrap the sole top-level role; it must not match an existing user account.
- Sensitive account and role operations write audit logs with actor, target, action, reason, timestamp, and IP address.
- Administrative suspension/block increments token version and revokes refresh sessions.
- Socket.IO now verifies the short-lived access token and derives identity/room membership server-side.

## Operational controls and limitations

- Auth endpoints have an in-memory IP rate limiter. Multi-instance deployments need a shared limiter store.
- Configure a real email provider endpoint and API key before production verification/reset delivery. Do not enable the mock provider in production.
- Do not configure domains from guesses; the institution must provide and own the approved list.
- Existing legacy tokens remain accepted until expiry when they have no tokenVersion claim; accounts with new status changes use versioned tokens and revoked sessions.
- Role/suspension audit writes and user changes are not wrapped in Mongo transactions; deploy with replica-set transactions or add an outbox/transaction when atomic audit guarantees are required.
- Profile images retain the existing controlled data URL behavior. A managed object-storage upload flow is not configured.
- A reset token generated before provider delivery failure is stored until expiry, but is not disclosed. The generic response avoids account enumeration.
