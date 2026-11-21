# Phase 4.8A — Navigation and Notes retirement

## Scope and safety

Phase 4.8A changes frontend discovery only. It performs no database migration, record update, collection drop, Cloudinary deletion, Docker volume reset, authentication change, or administrator mutation.

## Previous navigation

The top navigation was a flat list: Marketplace, My Listings, Saved, Notes, Requests, Network, Chat, About, plus Admin for authorized roles. Dashboard and Profile were available through the brand/account areas. The Dashboard also linked directly to Notes Exchange.

## New navigation

- Home: Dashboard.
- College Services — Coming soon: My Department, Notice Board, Campus Map, and Campus Issues. These entries are non-interactive, have no routes, and are announced as unavailable.
- Student Community: Marketplace, My Listings, Favorites, Chat, Network, and Community Requests.
- Account: Profile & Settings, About CampusSwap, and Admin only for `admin`, `college_admin`, and `super_admin` roles.

The existing responsive top-navbar architecture is retained. Wide layouts show active destinations and a non-interactive College Services status. Compact layouts render grouped sections in a bounded, vertically scrollable menu. Destination selection closes the compact menu; Escape and outside-pointer handling are preserved.

## Notes audit and retirement

The legacy Notes feature contains:

- `Note` Mongoose documents with title, description, external `fileUrl`, file type, branch, semester, subject, tags, bookmark count, and owner.
- `User.bookmarkedNotes` references and profile Notes statistics.
- Public paginated/filterable `GET /api/notes`, authenticated creation, and authenticated bookmark mutation routes.
- A frontend Notes page and API client.
- Seed and cleanup-script awareness.

Notes does not own a Cloudinary upload workflow; it stores externally supplied URLs. Marketplace category `Notes` and Community Request category `Notes` are independent features and remain active.

Retirement decisions:

- Removed Notes from active navigation and Dashboard shortcuts.
- `/notes` remains protected but renders a clear retired-feature notice linking to Marketplace and Community Requests. It never fetches Notes data.
- Updated active marketing copy so it no longer advertises Notes Exchange.
- Preserved the Notes page, API client, backend model/controller/routes, indexes, documents, bookmark references, file URLs, and historical profile counts for reversibility and data safety.
- No existing API contract was changed.

## Files changed

- `frontend/src/utils/navigation.js`
- `frontend/src/layouts/Navbar.jsx`
- `frontend/src/App.jsx`
- `frontend/src/pages/NotesRetired.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/About.jsx`
- `frontend/src/pages/Landing.jsx`
- `frontend/src/layouts/Footer.jsx`
- `frontend/test/navigation.test.js`
- `README.md`
- This document

## Reversal

To restore the legacy UI, point `/notes` back to `pages/Notes`, add the Notes destination to the Student Community navigation section, restore the Dashboard shortcut, and restore the marketing copy. No data restoration is required because Phase 4.8A does not modify Notes records, bookmarks, URLs, indexes, or APIs.

## Verification and follow-up

Final command results and any limitations are recorded in the Phase 4.8A completion report. Future College Services phases can replace the disabled entries with authorized routes without another navigation restructure. Phase 4.8A does not implement Department Hub, Notice Board, Campus Map, or Campus Issues behavior.
