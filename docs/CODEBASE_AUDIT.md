# CampusSwap Codebase Audit

Audit date: 2026-11-06. Findings below are based on repository source and package files, not the former README alone.

## Existing architecture

CampusSwap is a JavaScript modular monolith. The Vite React single-page frontend calls an Express 4 REST API and a Socket.IO server. Express controllers use Mongoose models directly; routes attach shared authentication, role checks, and a small set of body validators. MongoDB is the system of record. The current layout separates controllers, routes, models, middleware, config, scripts, and utilities without a service layer.

```text
frontend (React/Vite) -> /api proxy or VITE_API_BASE_URL -> Express -> Mongoose -> MongoDB
                                                  \-> Socket.IO -> connected browsers
```

## Folder structure

- `backend/config`: environment parsing and Mongoose connection.
- `backend/controllers`, `routes`, `models`: HTTP handlers, endpoint definitions, and schemas.
- `backend/middleware`: auth, database availability, security, request metadata, validation, and errors.
- `backend/scripts`: optional seed and admin bootstrap.
- `backend/test`: Node built-in test runner tests.
- `frontend/src`: React components, pages, layouts, context, hooks, API client, and assets.
- `frontend/api`: Vercel serverless API proxy.
- Root: Render deployment blueprint and README. No pre-existing Docker or Actions workflow was present.

## Technology inventory (verified)

- Node.js ESM, Express 4, Mongoose 8, MongoDB, JWT, bcrypt, Socket.IO 4.
- React 18, Vite 4, React Router 6, Tailwind 3, Framer Motion, Axios, Socket.IO client.
- npm lockfiles exist for both applications. Backend tests use `node:test`; frontend has no test or lint script.
- Render and Vercel configuration exists. No TypeScript, upload middleware, or external object storage integration was found.

## Current feature inventory

Routes and screens exist for authentication/profile, listings, bounties, messages, notes, connections, notifications, reports, borrow requests, and admin moderation. The UI includes landing, dashboard, marketplace, chat, networking, notes, notifications, profile, feedback, and admin pages. Socket events cover message delivery, typing, and presence. Feature existence does not establish production correctness; database-backed end-to-end verification requires a configured MongoDB.

## Verified findings

### Reliability and architecture

- The app is assembled in `backend/app.js`; HTTP and Socket.IO share the server in `backend/server.js`. Controllers access models directly. This is an understandable modular monolith; extracting services everywhere now would add indirection without improving current boundaries.
- `/health` and `/api/health` existed and return 503 while MongoDB is disconnected. A separate liveness route was absent; `/live` and `/api/live` have been added while preserving readiness paths.
- Database connection retries happen in the background. Startup logs connection failures and retains API availability for health checks.
- Graceful SIGINT/SIGTERM shutdown and frontend/backend Docker Compose setup have been added.
- Pagination already existed for listings, notes, and bounties; messages and request posts were unbounded. Messages and request posts now have bounded pagination. Several admin/report/user endpoints have fixed bounds or still need pagination as data grows.
- Frontend chat calls `getChat` once per student to create previews, which is an N+1 request pattern and may be slow at scale. This needs a dedicated bounded conversation-summary endpoint in a later, tested change.
- Frontend uses Vite build-time `VITE_*` config. Private values are not accessed by frontend source.

### Security

- Helmet, Mongo operator sanitization, HPP, CORS allow-list, request body size cap, and rate limiting already existed.
- Production error responses now replace 5xx details with a generic message; server logs retain the stack for diagnosis.
- Socket.IO accepts client-supplied `register(userId)` and `typing(senderId, ...)` identity without JWT validation. A client can impersonate presence/typing or join another user's message room. This is a high-priority security issue. Full socket auth affects existing client behavior and should be fixed with coordinated token handshake/client updates and security tests.
- The HTTP rate limiter uses its default in-memory store; per-instance limits do not coordinate across multiple Render instances. This is acceptable for a single instance; revisit only when scaling out.
- Reset-password implementation does not send email; in development its reset token is returned to the caller. Confirmed in `authController.js`; do not treat this endpoint as production email delivery.
- Browser auth stores JWT in localStorage, which is exposed to successful XSS. Reworking auth/session strategy is outside Phase 0 scope.
- `sanitizeUser` returns enrollment number and contact fields in API responses; some profile routes have connection-aware redaction. Perform a response-by-response privacy review before expanding profile or networking use.
- `ensureAdminUser` promotes an existing account matching `ADMIN_EMAIL` to admin and unblocks it. Protect those deployment variables and verify operational ownership before using them.

### Data and validation

- Mongoose timestamps, ObjectId references, schema enums, and several query indexes exist. Listing/note/bounty list endpoints use bounded page sizes.
- Message queries now have a bounded page and a supporting reverse-direction compound index; request listing now has page/limit and optional status filter.
- Admin user listing and user suggestions remain unbounded; request responses are embedded and can grow with a popular request. Add limits and response-size constraints before meaningful growth.
- Several controllers validate only required fields while relying on Mongoose for schema validation. Query parameters such as page and price are coerced without strict rejection of malformed input. A schema-validation dependency was not added because there is no existing validator framework and scope is incremental.
- Bookmark/favorite counters and user arrays update in parallel without transactions; concurrent toggles may drift. Correcting this safely requires an atomic update design and migration/backfill strategy.
- No binary upload handling was found. Notes and profile images store URL strings, which is appropriate for external storage.

### Build, tests, deployment

- Backend has Node test-runner tests for health behavior, auth validation, registration/login, and JWT middleware. Frontend has no tests, lint, or type-check scripts.
- Existing Vercel API proxy and Render blueprint are present. README contained stale developer-specific Windows paths.
- Docker and CI files have been introduced. Docker image/Compose validation depends on a running local Docker daemon; CI installs with lockfiles and runs the actual backend test command plus frontend production build.

## Recommendations

1. Coordinate authenticated Socket.IO handshake and authorize room membership before using messaging with untrusted clients.
2. Replace per-user chat preview fan-out with a server-side paginated conversation summary query.
3. Add strict request schemas to endpoints handling updates, reports, and admin actions; reject malformed IDs/query values consistently.
4. Bound admin/user/report reads and cap embedded request responses.
5. Review API user serialization and establish a single explicit public profile projection.
6. Move password reset delivery to a configured email provider before enabling it in production.
7. Add frontend tests for auth state and core API error handling when choosing a test framework is justified.
8. Consider service extraction only when concrete business logic is shared or controller complexity justifies it.

## Risks of modifying existing components

- Existing clients depend on response envelope differences (`listing` vs `data`, plain arrays vs paginated objects). Standardizing responses can break UI contracts.
- `/health` and `/api/health` are documented Render paths; both remain available and readiness semantics are preserved.
- Docker uses the Vercel/SPA API paths but local Compose routes `/api` through Nginx to the backend; Socket.IO is also proxied. Browser socket URL defaults to localhost, which is correct for local Compose and still configurable at frontend build time for remote deployment.
- Changes to auth or socket registration must be deployed with the frontend and backend together to avoid disconnecting chat clients.
