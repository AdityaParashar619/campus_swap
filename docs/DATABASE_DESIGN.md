# Database Design

MongoDB with Mongoose remains the persistence layer. Schemas currently use timestamps and ObjectId references for user relationships. Existing field names and documents are preserved; this phase adds no collection migration.

## Current collections

| Model/collection | Main relationships and purpose |
| --- | --- |
| User | Unique email and enrollment number; profile, auth, saved listing and bookmarked note references |
| Listing | Owner reference, marketplace attributes, image URL strings, visibility and favorites count |
| Note | Owner reference, external file URL, academic metadata and bookmark count |
| Bounty | Owner reference and created timestamp |
| RequestPost | Owner/fulfilled-user references and embedded responses |
| Connection | Requester and recipient user references with pending/accepted/rejected state |
| Message | Sender/receiver references and text |
| Notification | Recipient reference and typed metadata |
| Report | Reporter, target user, resolver references and moderation state |
| EmailVerification | Temporary pending student payload, HMAC OTP hash, expiry and attempts |
| RefreshSession | User, hashed opaque refresh token, family, expiry, revocation and replacement |
| AlumniVerification | Alumni review state, requested profile details and reviewer metadata |
| AuditLog | Administrative actor, action, target, reason, request IP and timestamp |

## Existing important indexes

- User: email is uniquely indexed. Enrollment number has a partial unique index for string values so alumni can store `null`; inspect the existing production index and duplicates before rollout.
- Connection: unique requester/recipient pair.
- Listing: created date, category, availability, tags, and text search fields.
- Note: branch/semester/subject and text search fields.
- Bounty and RequestPost: created date; RequestPost also status/created date.
- Notification: user/created date; Report: status/created date.
- Message: sender/receiver/created date plus reverse receiver/sender/created date for either conversation direction.
- EmailVerification: unique email/kind and TTL expiry.
- RefreshSession: unique token hash, user and family indexes, TTL expiry.
- AlumniVerification: unique email/user, status lookup, and TTL expiry for unverified email links.
- AuditLog: actor and target-user lookups.

Index changes should follow observed query patterns and production explain plans. Avoid adding indexes on every filter because each index adds storage and write cost. Before deploy, inspect `users` indexes and duplicate/empty enrollment values; reconcile the legacy unique index and create the partial index through a planned maintenance migration if necessary.

## Query conventions

- Use page/limit defaults and enforce a hard maximum. Listings and notes use 12/50; chat history uses 50/100; request posts use 12/50.
- Sort newest first for feeds. Chat pages return the selected page in chronological display order.
- Use `.select()`/populate projections that omit password and reset-token fields. Use `.lean()` when returned documents are read-only and populate behavior is not needed.
- Avoid unbounded `find()` and per-user fan-out queries. The frontend currently fetches each user's chat separately; replace with a conversation summary endpoint before growth.
- Keep files in object storage and persist URLs/metadata; do not store image or video binaries in MongoDB.
- Embedded request responses are convenient for current behavior but need a maximum size or separate collection if they grow without bound.

## Future extension guidelines

Preserve existing records and response shapes when adding fields. Use explicit enums/defaults for status, timestamps for mutable entities, ObjectId refs for cross-collection relationships, and unique indexes only for true invariants. Plan index creation and duplicate cleanup before adding uniqueness to existing collections. Use atomic updates or transactions for coupled counters and references when concurrent writes can violate consistency.

## IAM compatibility

The legacy User collection continues using `password`, `role`, `yearSemester`, `isVerifiedStudent`, and `isBlocked` as compatibility fields. New account and verification fields are additive. Legacy users lacking `accountStatus` remain active unless `isBlocked` is true; legacy accounts are not automatically forced through the new OTP workflow. New student registrations are stored temporarily in `EmailVerification`, then inserted into User after OTP success; this confirms mailbox ownership only. Alumni details and password hash remain in an email-pending `AlumniVerification` record until the applicant verifies the personal email; a pending User record is then created for authorized review. Refresh tokens are never stored in plaintext.
