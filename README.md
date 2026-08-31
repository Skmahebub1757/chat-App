# Pulse — Real-Time Chat App

A full-stack, real-time one-to-one chat application: Node.js/Express + Socket.IO + SQLite on the
backend, and a fast, dependency-free HTML/CSS/JS frontend (no build step required).

## Features

- **Authentication** — sign up, log in, log out, hashed passwords (bcrypt), JWT sessions in
  httpOnly cookies, protected pages.
- **Registration** collects full name, username, email, password, and an optional profile picture.
- **Chat dashboard** — sidebar with your profile, user search, online/offline status (green dot),
  last message preview, unread counts; main panel with real-time messaging, timestamps, distinct
  sent/received bubbles, auto-scroll, a typing indicator, and delivered/read receipts.
- **Account page** — view your info, change your photo, edit name/username/email, change your
  password, log out.
- **Modern UI** — dark/light theme toggle, responsive layout (desktop + mobile), smooth
  animations, loading skeletons, toast notifications, and an empty state.

## Tech stack

- **Backend:** Node.js, Express, Socket.IO, mysql2, bcryptjs, jsonwebtoken, multer
- **Frontend:** Plain HTML/CSS/JavaScript (no framework or bundler needed)
- **Database:** MySQL on Amazon RDS

## 1. Create the RDS MySQL instance

If you don't already have one:

1. In the AWS console, go to **RDS → Create database**.
2. Choose **MySQL** as the engine (8.x recommended).
3. Under **Templates**, pick Free tier / Dev-test, or Production depending on your needs.
4. Set a master username and password — you'll need these in `.env`.
5. Under **Connectivity**, note the VPC/subnet, and set **Public access** to "Yes" if you're
   connecting from outside AWS (e.g. your laptop), or "No" if the app runs inside the same VPC
   (e.g. on EC2/ECS).
6. Under **Additional configuration**, you can optionally set an **initial database name**
   (e.g. `pulse_chat`) — if you skip this, create it manually in step 3 below.
7. Create the database and wait for it to become "Available".
8. Open the instance's **Connectivity & security** tab and copy the **endpoint** (host) and
   **port** (3306 by default).
9. Edit the instance's **VPC security group** → inbound rules → add a rule allowing **TCP 3306**
   from your IP (for local development) or from the security group of whatever will run this app
   (EC2, ECS, Elastic Beanstalk, etc).

## 2. Create the database (if you didn't set one on creation)

Connect with the MySQL CLI (or a GUI client like MySQL Workbench / TablePlus) and run:

```sql
CREATE DATABASE pulse_chat CHARACTER SET utf8mb4;
```

```bash
mysql -h <DB_HOST> -P 3306 -u <DB_USER> -p -e "CREATE DATABASE pulse_chat CHARACTER SET utf8mb4;"
```

You don't need to create any tables by hand — the app creates the `users` and `messages` tables
automatically on startup if they don't already exist (see `src/db.js`).

## 3. Configure and run the app

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and fill in:

   ```
   JWT_SECRET=<a long random string>

   DB_HOST=<your RDS endpoint, e.g. pulse-chat.xxxxxxxxxx.us-east-1.rds.amazonaws.com>
   DB_PORT=3306
   DB_USER=<your RDS master username>
   DB_PASSWORD=<your RDS master password>
   DB_NAME=pulse_chat
   DB_SSL=true
   ```

   `DB_SSL=true` connects over SSL using `mysql2`'s default trusted CA bundle, which RDS's
   certificates work with. Set it to `false` only if you have a specific reason to disable SSL.

3. **Run the app**

   ```bash
   npm start
   ```

   For auto-restart on file changes during development:

   ```bash
   npm run dev
   ```

   On startup you should see `Pulse chat server running at http://localhost:5000`. If the DB
   settings are wrong, the app logs a clear connection error and exits instead of starting up in
   a broken state.

4. Open **http://localhost:5000** in your browser. Create an account, then open the same URL in
   a second browser (or an incognito window) to sign up a second user and chat between the two in
   real time.

### Troubleshooting

- **`ETIMEDOUT` / connection hangs** — almost always a security group issue: add an inbound rule
  on the RDS instance's security group allowing TCP 3306 from wherever the app is running.
- **`Access denied for user`** — double-check `DB_USER`/`DB_PASSWORD` in `.env`.
- **`Unknown database 'pulse_chat'`** — create it first (see step 2 above), or set
  `DB_NAME` to a database that already exists.
- **SSL handshake errors** — try `DB_SSL=false` temporarily to confirm it's an SSL issue, then
  check whether your RDS instance enforces SSL (`rds.force_ssl` parameter) and needs a specific CA
  bundle.

## Project structure

```
chat-app/
├── server.js              # App entry point (Express + Socket.IO)
├── src/
│   ├── db.js               # MySQL (RDS) connection pool + schema init
│   ├── presence.js         # Tracks who is currently online
│   ├── socket.js            # Real-time events: messages, typing, read receipts
│   ├── upload.js            # Multer config for avatar uploads
│   ├── middleware/auth.js   # JWT signing/verification, route protection
│   └── routes/
│       ├── auth.js          # /api/auth: register, login, logout, me
│       ├── users.js         # /api/users: list, search, profile & password updates
│       └── messages.js      # /api/messages: conversation history, mark as read
├── public/                  # Frontend (static, no build step)
│   ├── index.html            # Login
│   ├── register.html         # Sign up
│   ├── chat.html              # Chat dashboard
│   ├── profile.html           # Account page
│   ├── css/style.css
│   └── js/
│       ├── api.js             # Fetch helpers, toasts, formatting utils
│       ├── theme.js           # Dark/light theme toggle
│       ├── login.js
│       ├── register.js
│       ├── chat.js             # Sidebar, messaging, typing, presence
│       └── profile.js
└── uploads/                  # Uploaded profile pictures (served at /uploads)
```

## How real-time messaging works

- On login, the browser opens a Socket.IO connection authenticated with the same JWT cookie used
  by the REST API.
- The server tracks each connected user in-memory (`src/presence.js`) and broadcasts
  `presence:online` / `presence:offline` events, which drive the green status dot.
- Sending a message emits `message:send`; the server persists it to SQLite and pushes
  `message:new` to the recipient's socket room, so both sides update instantly without a page
  refresh.
- Typing emits lightweight `typing:start` / `typing:stop` events to the other person only.
- Opening a conversation (or receiving a message while it's open) emits `messages:read`, which
  flips the read receipt on the sender's side.

## Notes & next steps

- The `users` and `messages` tables are created automatically on startup if they don't already
  exist — no migration step needed for a fresh database.
- Uploaded avatars are stored in `/uploads` and served statically; swap this for S3 or similar in
  production (especially if you run more than one app instance, since local disk storage won't be
  shared between them).
- For production deployment, set `NODE_ENV=production` (this makes auth cookies `secure`, so
  you'll also need HTTPS) and put the app behind a process manager such as PM2.

## Running multiple instances behind a load balancer

Socket.IO needs a bit of extra setup once you run more than one instance/process (multiple EC2/ECS
tasks behind an ALB, PM2 cluster mode, etc.) — otherwise you'll see `400 Bad Request` /
`"Session ID unknown"` errors, and messages will silently fail to reach users whose socket landed
on a different instance than yours.

1. **Enable sticky sessions on the load balancer.** On an AWS ALB, open the target group →
   **Attributes** → enable **Stickiness** (duration-based, e.g. 1 day). This keeps each browser's
   requests pinned to the same instance, which fixes the "Session ID unknown" polling error.
   Stickiness alone is *not* enough for correct chat delivery, though — see the next step.

2. **Set `REDIS_URL`.** This app uses the official Socket.IO Redis adapter so that instances can
   relay events to each other, and stores online/offline presence in Redis instead of per-process
   memory. Without it, User A on instance 1 and User B on instance 2 simply won't be able to message
   each other, even though each instance looks like it's working fine in isolation. Spin up an
   Amazon ElastiCache for Redis cluster (or any Redis instance reachable from your app), then set:

   ```
   REDIS_URL=redis://your-cluster-endpoint:6379
   REDIS_TLS=true   # if your Redis requires TLS (e.g. ElastiCache in-transit encryption)
   ```

   On startup, the server logs `Socket.IO Redis adapter attached — safe to run multiple instances.`
   If `REDIS_URL` isn't set, it falls back to a single-instance in-memory adapter and logs a
   warning — fine for local dev or a single-instance deployment, but not safe behind a
   multi-instance load balancer.

3. **Make sure the load balancer allows WebSocket upgrades** (ALBs do this natively) and has a
   sufficiently long idle timeout for long-lived connections.
