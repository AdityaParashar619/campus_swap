# CampusSwap

A peer-to-peer campus marketplace and bounty board for college students.

## Project Structure

```
campusswap/
├── backend/
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API routes
│   ├── controllers/      # Business logic
│   ├── middleware/       # Auth, validation, etc.
│   ├── config/          # Database config
│   ├── server.js        # Main Express app
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/   # React components
    │   ├── pages/        # Page components
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── public/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── package.json
```

## Setup Instructions

### Backend

```bash
cd campusswap/backend
cp .env.example .env
npm install
npm run dev  # Start dev server with nodemon
```

Make sure MongoDB is running locally on port 27017.

### Frontend

```bash
cd campusswap/frontend
npm install
npm run dev  # Start Vite dev server on port 5173
```

## Tech Stack

- **Frontend:** React (Vite) + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + Socket.io
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (simple email-based)

## Next Steps

1. Create MongoDB models (User, Listing, Message, Bounty)
2. Build API routes and controllers
3. Create frontend pages with animations
4. Implement Socket.io chat
