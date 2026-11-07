# API Documentation

The existing `/api` prefix is retained for client compatibility. Authentication endpoints are grouped under `/api/auth`; user and administrative operations reuse existing routes.

## Authentication

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| POST | `/api/auth/register/student` (`/register` alias) | Public, rate limited | Validate institution values and queue hashed-password pending OTP payload |
| POST | `/api/auth/verify-email` | Public, rate limited | Verify six-digit OTP and activate student account |
| POST | `/api/auth/resend-otp` | Public, rate limited | Rotate pending OTP (60 second cooldown) |
| POST | `/api/auth/register/alumni` | Public, rate limited | Create pending alumni account and review request |
| POST | `/api/auth/verify-alumni-email` | Public, rate limited | Verify the pending alumni account email link |
| POST | `/api/auth/login` | Public, rate limited | Check credentials and account state; sets HttpOnly refresh cookie, returns short-lived access token |
| POST | `/api/auth/refresh` | Refresh cookie, trusted origin | Rotate refresh session and return short-lived access token |
| POST | `/api/auth/logout` | Refresh cookie, trusted origin | Revoke current refresh session and clear cookie |
| POST | `/api/auth/forgot-password` | Public, rate limited | Generic response; sends reset URL via configured provider |
| POST | `/api/auth/reset-password` | Public, rate limited | Consume single-use expiring reset token and revoke sessions |

## Profile

- `GET /api/auth/me`: authenticated self profile and existing feature stats.
- `PATCH /api/auth/me`: allowlisted profile fields; protected identity/status fields are ignored.
- `PATCH /api/auth/me/password`: current password plus new password and confirmation; revokes sessions.

## Administration

- `GET /api/admin/iam/users?q=&role=&status=&page=&limit=` and `GET /api/admin/iam/users/:id`: `users:read`.
- `PATCH /api/admin/iam/users/:id/status`: `users:manage`; requires `status` and reason.
- `PATCH /api/admin/iam/users/:id/role`: `users:manage`; role, optional reason, and configured department/club scope for coordinator roles; elevated administrator assignment is super-admin only.
- `GET /api/admin/iam/verifications/alumni`: `verifications:review`.
- `PATCH /api/admin/iam/verifications/alumni/:id`: `verifications:review`; decision is `approved` or `rejected`.

Responses use the established `{ success, data, message }` envelope. Access JWTs are sent in the `Authorization: Bearer` header by web clients; refresh tokens are cookie-only and never returned in JSON. The refresh endpoint currently requires a browser Origin and HttpOnly cookie; native clients need a separately designed platform-secure refresh transport before use.
