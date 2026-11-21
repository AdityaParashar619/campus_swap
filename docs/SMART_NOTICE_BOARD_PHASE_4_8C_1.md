# Smart Notice Board — Phase 4.8C.1 Backend Foundation

## Scope

This phase adds the authenticated Notice Board backend only. It does not add student or administrator frontend pages, seed notices, send notification fan-out, scrape external sites, or modify existing data.

## Notice schema

`Notice` stores:

- bounded `title` and plain-text `content`;
- `category`: `academic`, `examination`, `placement`, `event`, or `general`;
- `priority`: `normal`, `important`, or `urgent`;
- `status`: `draft`, `published`, or `archived`;
- `targetScope`: `college`, `program`, or `semester`;
- canonical `targetPrograms` and optional `targetSemester`;
- optional HTTPS attachment and source URLs with bounded labels;
- optional expiry;
- server-managed publication/archive timestamps and administrator references;
- standard Mongoose timestamps.

Indexes cover active targeting with stable publication ordering and administrator category/priority filtering. There is no redundant department target: the canonical program registry remains the authority. Department targeting is a possible later extension only if a real requirement emerges.

## Lifecycle

- Creation always produces a draft, regardless of client input.
- `POST /api/admin/notices/:id/publish` publishes a valid draft or republishes an archived notice. `publishedAt` is server-generated. Republishing creates a new publication timestamp.
- Editing a published notice revalidates its publication constraints but does not change `publishedAt`.
- `POST /api/admin/notices/:id/archive` accepts published notices only and sets `archivedAt`.
- Draft and archived notices never appear in student queries.
- Expired notices are filtered by the backend query; no scheduler is required.

Publication rejects missing content, invalid targeting, unsafe URLs, and an expiry at or before publication time.

## Targeting

- `college`: all authenticated users; no program or semester restrictions.
- `program`: one or more codes from the existing academic registry; no semester restriction.
- `semester`: one or more canonical programs plus an integer semester from 1 through 8.

The service reloads `branch` and `semester` from the authenticated database user, resolves branch through the existing academic registry, and ignores client-supplied identity. Enrollment numbers are never used for inference. A user whose program cannot be resolved receives college-wide notices only.

## API

All routes require a bearer access token. Mutation and administration routes additionally require `admin`, `college_admin`, or `super_admin`.

### Administrator

- `POST /api/admin/notices`
- `GET /api/admin/notices?page=1&limit=20&status=draft&category=academic`
- `GET /api/admin/notices/:id`
- `PATCH /api/admin/notices/:id`
- `POST /api/admin/notices/:id/publish`
- `POST /api/admin/notices/:id/archive`

Example draft request:

```json
{
  "title": "Semester registration window",
  "content": "Complete registration before Friday.",
  "category": "academic",
  "priority": "important",
  "targetScope": "semester",
  "targetPrograms": ["CSE"],
  "targetSemester": 7,
  "sourceUrl": "https://www.satiengg.in/example"
}
```

The server rejects protected or unknown fields such as `status`, `createdBy`, `updatedBy`, `publishedAt`, and `archivedAt`.

### Student

- `GET /api/notices?page=1&limit=20&category=academic&priority=important&search=registration`
- `GET /api/notices/:id`

Example response item:

```json
{
  "id": "0123456789abcdef01234567",
  "title": "Semester registration window",
  "content": "Complete registration before Friday.",
  "category": "academic",
  "priority": "important",
  "targetScope": "semester",
  "attachmentUrl": null,
  "attachmentLabel": "",
  "sourceUrl": "https://www.satiengg.in/example",
  "sourceLabel": "",
  "publishedAt": "2026-11-21T00:00:00.000Z",
  "expiresAt": null,
  "attribution": "Published on CampusSwap"
}
```

Student responses omit administrator references, archive state, and internal moderation fields. ID lookup uses the same targeting and expiry predicate as the feed, preventing scope bypass.

## Security decisions

- Existing authentication, role authorization, global Helmet/Mongo sanitization/HPP/rate limiting, and the user-keyed creation limiter are reused.
- Mutation payloads use an allowlist and never trust audit identities or lifecycle timestamps.
- URLs must parse as HTTPS; `javascript:`, `data:`, `file:`, malformed, and non-HTTPS values are rejected.
- Content is stored and returned as text in JSON. No HTML rendering or script execution is introduced.
- Search is capped at 100 characters and regex metacharacters are escaped.
- Pagination is capped at 50 records and page 10,000.
- Results sort by `publishedAt` descending and `_id` descending for stable ties.
- CampusSwap uses neutral `Published on CampusSwap` attribution. A source URL does not imply independent verification.

## Testing

Focused unit tests cover schema targeting, canonical programs, unsafe URLs, lifecycle timestamps, expiry, identity-derived filters, bounded pagination/search, and response privacy. The isolated MongoDB API test covers draft creation, role denial, publication, ordinary published edits, archival, republication, expiry, college/program/semester targeting, cross-program and cross-semester isolation, ID isolation, spoof rejection, invalid inputs, search, pagination, and administrator filtering.

Exact execution results are reported in the Phase 4.8C.1 handoff so this document does not become stale.

## Known limitations and Phase 4.8C.2

- No frontend Notice Board or admin management interface exists yet.
- There is no read/unread state, acknowledgement tracking, scheduled publication, push/email delivery, or notification fan-out.
- Expiry is query-time visibility, not a background status transition.
- Keyword search uses bounded escaped matching; a dedicated search engine is unnecessary at current scale.
- Phase 4.8C.2 can implement accessible student presentation using only the student API and neutral attribution, without changing targeting authority.
