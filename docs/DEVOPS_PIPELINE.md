# DevOps Pipeline

## Local containers

Docker Compose runs three services: Vite production assets via Nginx, the Express/Socket.IO backend, and MongoDB with a named persistent volume. MongoDB has a ping health check; backend waits for it and exposes a process liveness health check; frontend waits for backend health. Nginx provides SPA fallback plus `/api` and Socket.IO proxying.

The backend image installs from `package-lock.json` with `npm ci --omit=dev`, uses Node 22 Alpine, runs as the unprivileged Node user, and excludes local env files through `.dockerignore`. The frontend image builds with `npm ci` and serves static output with Nginx. `VITE_*` settings are build-time public configuration.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes and pull requests targeting `main` or `develop`. Separate jobs use Node 22 and npm caching, run `npm ci`, run backend Node tests, and build the frontend. Frontend tests and lint are run only if real npm scripts are later configured; none currently exist. There is no backend build/type-check script because the backend is JavaScript executed directly by Node. No production deployment is configured.

## Existing hosting configuration

`render.yaml` describes the Render backend and static frontend. `frontend/vercel.json` provides SPA fallback, and `frontend/api/[...path].js` proxies API requests when configured. Keep production secrets in hosting environment settings; never add them to `.env.example`, Vite variables, or images.

## Operational considerations

- Configure MongoDB Atlas network access and a least-privilege application user.
- Configure `JWT_SECRET`, `MONGO_URI`, `FRONTEND_URL`, and optional admin bootstrap values in the backend host.
- Configure Vite API/socket public URLs before frontend build when not using same-origin proxy.
- `/live` is process liveness; `/health` and `/api/health` are database readiness checks and preserve prior deployment paths.
- In-memory rate limiting is per backend instance. Use a shared store only if multi-instance requirements emerge.
- Socket.IO identity currently trusts registration payloads; address the audit finding before exposing real-time messaging to a hostile environment.
