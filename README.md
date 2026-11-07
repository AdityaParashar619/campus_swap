# CampusSwap

CampusSwap is a campus-focused student ecosystem built as a React/Vite frontend and a Node.js/Express modular monolith backed by MongoDB/Mongoose. Current features include marketplace listings, notes, requests, networking, messaging, notifications, reports, and moderation.

## Repository layout

```text
backend/       Express API, Socket.IO, Mongoose models, tests
frontend/      React SPA and Vite build
docs/          Audit, architecture, database, setup, and DevOps notes
docker-compose.yml
```

## Start locally

Use Node.js 22+, copy `backend/.env.example` to `backend/.env`, set a private JWT secret, and start MongoDB. Then run `npm ci && npm run dev` in `backend/` and `npm ci && npm run dev` in `frontend/`. See [Development Setup](docs/DEVELOPMENT_SETUP.md) for Docker, environment details, and troubleshooting.

## Docker

Copy root `.env.example` to `.env`, set `JWT_SECRET`, then run:

```sh
docker compose up --build
```

Open `http://localhost:8080`. Logs: `docker compose logs -f`; stop: `docker compose down`. `docker compose down -v` removes the local database volume.

## Checks

```sh
cd backend && npm test
cd frontend && npm run build
```

CI runs backend tests and the frontend production build for pushes and pull requests to `main` and `develop`. The frontend currently has no configured test or lint scripts.

## Architecture and operations

- [Codebase audit](docs/CODEBASE_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [Development setup](docs/DEVELOPMENT_SETUP.md)
- [DevOps pipeline](docs/DEVOPS_PIPELINE.md)
- [API documentation](docs/API_DOCUMENTATION.md)
- [Security decisions and configuration](docs/SECURITY.md)
- [Phase 1 IAM completion report](docs/PHASE_1_COMPLETION_REPORT.md)

## Identity configuration

Student registration requires the institution's approved domains in backend `ALLOWED_COLLEGE_DOMAINS`; optional enrollment, department, branch, club, and semester values are configured using `ENROLLMENT_PATTERN`, `INSTITUTION_DEPARTMENTS`, `INSTITUTION_BRANCHES`, `INSTITUTION_CLUBS`, and `INSTITUTION_SEMESTERS`. Configure `EMAIL_PROVIDER_URL`, `EMAIL_PROVIDER_API_KEY`, and a separate `OTP_PEPPER` for delivery and OTP hashing. Production student registration fails closed without approved domains and email delivery. Alumni accounts stay pending until an authorized institutional review.

For IAM access, configure a dedicated `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` before first startup. `ADMIN_EMAIL` creates only the legacy moderation administrator and cannot grant IAM roles. Do not point the super-admin bootstrap at an existing user account.

Readiness health paths remain `/health` and `/api/health`; process liveness is `/live`. Render and Vercel deployment configuration remains in the repository. Set secrets in hosting configuration, not in frontend build variables or committed files. No automatic production deployment is configured.
