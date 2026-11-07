# Development Setup

## Requirements

- Node.js 22 (CI and Docker use Node 22; local use Node 20+).
- npm and either Docker Desktop or a local MongoDB instance.

## Local environment

Copy `backend/.env.example` to `backend/.env`; set a private random `JWT_SECRET`. Start MongoDB, then run:

```powershell
cd backend
npm ci
npm run dev
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Vite serves `http://localhost:5173` and proxies `/api` to port 5000. `VITE_API_BASE_URL` and `VITE_SOCKET_URL` can point to a separately deployed backend; these values are visible to browser users.

## Docker Compose

Copy root `.env.example` to `.env`, generate a unique 32+ character JWT secret, then run:

```sh
docker compose up --build
docker compose down
docker compose logs -f backend
docker compose build --no-cache
docker compose down -v
```

The app is served at `http://localhost:8080`. `down -v` deletes the local MongoDB data volume. Set `FRONTEND_PORT` to change the host port. Optional admin bootstrap variables are for local development only; do not use production credentials here.

## Tests and builds

```sh
cd backend && npm test
cd frontend && npm run build
```

There is no frontend test/lint script currently. Backend tests use Node's built-in runner. Run Docker verification with `docker compose config` and `docker compose up --build` when a Docker daemon is available.

## Troubleshooting

- `503` at `/health`: backend is alive but MongoDB is not ready; check `MONGO_URI` and MongoDB logs.
- `404` or HTML where JSON is expected: check `VITE_API_BASE_URL`, Vercel `API_PROXY_TARGET`, or Compose Nginx proxy.
- Socket doesn't connect in remote deployments: set `VITE_SOCKET_URL` to the backend origin and include the frontend origin in `FRONTEND_URL`.
- Compose complains about `JWT_SECRET`: copy `.env.example` to `.env` and set the required value.

## Branching

Create short-lived branches from `develop` for routine work and target pull requests to `develop`; promote reviewed releases to `main`. The workflow validates pushes and pull requests to both branches. This is a repository convention; no branch protection configuration is committed here.
