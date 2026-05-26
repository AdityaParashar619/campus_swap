# CampusSwap

CampusSwap is a student ecosystem platform with marketplace, notes exchange, networking, requests, chat, notifications, and moderation.

## Stack
- Frontend: React + Vite + Tailwind + Framer Motion
- Backend: Node.js + Express + Socket.io
- Database: MongoDB + Mongoose
- Auth: JWT

## Project Structure
```text
campus_swap/
  backend/
    config/
    controllers/
    middleware/
    models/
    routes/
    scripts/
    utils/
    server.js
  frontend/
    src/
      components/
      context/
      hooks/
      layouts/
      pages/
      services/
```

## Prerequisites
- Node.js 20+ (you already have Node 24)
- MongoDB Community Server (local) OR MongoDB Atlas URI

## Environment Setup

### Backend `.env`
Path: `backend/.env`

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/campusswap
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
SEED_ON_STARTUP=false
```

## Run Locally

### 1) Start MongoDB
If installed as service (Windows PowerShell as Admin):
```powershell
net start MongoDB
```

If not installed as service, start manually:
```powershell
"C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
```

### 2) Start Backend
```powershell
cd C:\Users\devan\campus_swap\campus_swap\backend
npm run dev
```

### 3) Start Frontend
```powershell
cd C:\Users\devan\campus_swap\campus_swap\frontend
npm run dev
```

## If `npm` fails in PowerShell
Run once in an Admin PowerShell:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Then close and reopen PowerShell.

## If backend says `ECONNREFUSED 127.0.0.1:27017`
MongoDB is not running yet. Start MongoDB first, then rerun backend.

## Notes
- Backend now defaults to `mongodb://127.0.0.1:27017/campusswap` if `MONGO_URI` is not provided.
- Startup errors now print clear MongoDB setup tips.

## Public Deployment

The repo includes `render.yaml` for Render deployment:

- `campusswap-api`: Node backend from `backend/`
- `campusswap-web`: static frontend from `frontend/`

Required production environment variables:

Backend:
```env
MONGO_URI=<MongoDB Atlas connection string>
JWT_SECRET=<long random secret>
FRONTEND_URL=<deployed frontend URL>
ADMIN_EMAIL=<admin login email>
ADMIN_PASSWORD=<strong admin password>
ADMIN_NAME=CampusSwap Admin
```

Frontend:
```env
VITE_API_BASE_URL=<deployed backend URL>/api
VITE_SOCKET_URL=<deployed backend URL>
```

Do not deploy with the local demo admin password from `backend/.env`.
