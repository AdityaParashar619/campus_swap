# Smart Notice Board — Phase 4.8C.2 Student UI

## Routes and navigation

- `/notices` is the authenticated student Notice Board.
- `/notices/:id` is the authenticated notice detail route.
- **Notice Board** is enabled once under **College Services**, alongside **My Department**. Notes remains under Student Community.

Both routes use the existing `ProtectedRoute`, shared layout, responsive navbar, theme system, and lazy loading. No administrator Notice UI is included.

## Components

`NoticeBoard.jsx` provides:

- heading and neutral CampusSwap description;
- debounced keyword search;
- category and priority filters;
- responsive notice cards;
- loading skeletons;
- explicit empty and error states with retry;
- bounded previous/next pagination;
- category, priority, publication date, neutral scope label, content preview, and detail action.

`NoticeDetails.jsx` provides full plain-text content, category, priority, publication date, neutral attribution, optional secure attachment/source links, back navigation, loading state, and a unified unavailable state for missing, expired, archived, or unauthorized notices.

## API integration

The existing authenticated Axios client exposes:

- `noticeAPI.getAll(params, { signal })` → `GET /api/notices`
- `noticeAPI.getById(id, { signal })` → `GET /api/notices/:id`

The list sends only backend-supported `search`, `category`, `priority`, `page`, and `limit` parameters. Filters reset the page to one. Search waits 300 ms. Requests use `AbortController` plus a monotonic request identifier so stale responses cannot replace newer results.

Program and semester are never sent by the browser. The backend remains the sole targeting authority.

## Security and attribution

- Notice content is rendered through normal React text nodes with whitespace preservation; no HTML execution API is used.
- Only URLs that parse as HTTPS survive frontend normalization.
- External links use a new tab, `noopener noreferrer`, and `no-referrer`.
- Malformed response records fail closed.
- Student pages do not render creator/updater identities, archive metadata, or admin controls.
- Notices use **Published on CampusSwap**, never an unsupported official-institution claim.
- The detail route relies on backend ID-scope enforcement and treats inaccessible records as unavailable.

## Empty and error behavior

An empty result shows **No notices available** and **New announcements will appear here when they are published.** Request failures show an accessible alert and Retry action. The application contains no hardcoded or seeded notice records.

## Testing

Focused tests cover normalization, safe URLs, plain-text content, metadata, loading/empty/error states, retry, filters, pagination, overlapping requests, detail security, protected routes, navigation, Notes, and My Department regressions.

Chromium uses only disposable fixtures: an administrator creates and publishes a CSE Semester 7 notice through the isolated backend, a matching student opens its safe detail/attachment, student admin mutation is denied, and the fixture is archived after verification.

Exact command results are recorded in the task handoff rather than embedded here.

## Remaining limitations and Phase 4.8C.3

- There is no admin Notice management frontend yet.
- There is no read/unread state, acknowledgement tracking, push delivery, or client-side offline cache.
- Scope labels are intentionally generic because student API responses do not expose target-program arrays.
- Phase 4.8C.3 may add an authorized admin interface using the existing backend endpoints without weakening student targeting.
