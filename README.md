# ServerDock

ServerDock is a self-hosted server management panel for Ubuntu 24/25. It provides a web UI to inspect system metrics, manage packages, Nginx vhosts, PM2 processes, and databases, plus a browser-based terminal.

> **Warning:** ServerDock is powerful and runs with elevated privileges. Only install it on servers you fully control and trust.

## Features

- One-line installer for Ubuntu 24/25
- Secure token-based first login with JWT sessions
- System dashboard with CPU, RAM, disk, and load
- Package management (apt, npm, common runtimes, web servers, DBs, tools)
- Nginx virtual host management and test/reload controls
- PM2 process listing and control
- Database status and simple management (PostgreSQL, MySQL, Redis)
- Web terminal via WebSocket and `node-pty`

## Quick install

SSH to your Ubuntu 24.04/25.04 server as root (or with sudo) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/xoxma1993/ServerDock/main/install.sh | bash
```

The installer will:

- Install Node.js 20 (via NodeSource) if needed
- Clone or update `https://github.com/xoxma1993/ServerDock.git` into `/opt/serverdock`
- Install npm dependencies
- Generate `.env` with a random `SECRET_TOKEN` and `JWT_SECRET`
- Start the panel with PM2 as `serverdock`

On success you will see a banner like:

```text
╔══════════════════════════════════════════════════════════╗
║  ServerDock is running!                                  ║
║  Open: http://<SERVER_IP>:2580/?token=<SECRET_TOKEN>     ║
║  (Token is embedded in the URL for first login)          ║
╚══════════════════════════════════════════════════════════╝
```

Open the printed URL in your browser to auto-complete the first login.

## Login & authentication

- The installer generates a shared **setup token** and stores it in `/opt/serverdock/.env` as `SECRET_TOKEN`.
- First-time access is done via a link with `?token=<SECRET_TOKEN>`; the frontend reads this token and calls:

  - `POST /api/auth/login` with body `{ "token": "<SECRET_TOKEN>" }`

- The backend verifies the token, then issues a **JWT** valid for 24 hours.
- The frontend stores the JWT in `localStorage` under `serverdock_jwt` and sends it as `Authorization: Bearer <jwt>` for all subsequent API calls.

You can regenerate the token manually by editing `/opt/serverdock/.env` and restarting:

```bash
cd /opt/serverdock
pm2 restart serverdock
```

## Development setup

On a development machine (not the production server):

```bash
git clone https://github.com/xoxma1993/ServerDock.git
cd ServerDock
npm install
cd client && npm install && cd ..
```

Create `.env` in the project root:

```bash
PORT=2580
SECRET_TOKEN=devtoken1234567890
JWT_SECRET=devjwtsecret1234567890
```

Run both backend and frontend in dev mode:

```bash
npm run dev
```

- Backend: `http://localhost:2580`
- Frontend: `http://localhost:5173` (proxied to backend for `/api` and `/ws`)

For production build:

```bash
cd client
npm run build
cd ..
npm start
```

This builds the React app into `public/` and serves it via Express on `PORT` (default `2580`).

## APIs overview

All routes except `/api/auth/login` and `/health` require a valid JWT:

- Header: `Authorization: Bearer <jwt>`

### Auth

- `POST /api/auth/login` — `{ token: "SECRET_TOKEN" }` → `{ token: "<jwt>" }`

### System

- `GET /api/system` — returns OS, hostname, uptime, CPU, RAM, disk, IP, load averages.

### Packages

- `GET /api/packages/status` — list of managed packages with install status and version.
- `POST /api/packages/install` — body `{ id }`, streams install via SSE.
- `POST /api/packages/remove` — body `{ id }`, streams removal via SSE.

### Nginx

- `GET /api/nginx/domains` — list parsed vhost configs.
- `POST /api/nginx/domains` — create vhost.
- `PUT /api/nginx/domains/:id` — update vhost.
- `DELETE /api/nginx/domains/:id` — delete vhost and symlink.
- `POST /api/nginx/domains/:id/enable` / `disable` — manage symlink in `sites-enabled`.
- `POST /api/nginx/domains/:id/ssl/letsencrypt` — run certbot for the domain.
- `POST /api/nginx/test` — run `nginx -t`.
- `POST /api/nginx/reload` — run `systemctl reload nginx`.

### PM2

- `GET /api/pm2/processes` — list PM2 processes.
- `POST /api/pm2/processes` — start new process.
- `DELETE /api/pm2/processes/:name` — delete process.
- `POST /api/pm2/processes/:name/restart` / `stop` / `start` — control processes.
- `GET /api/pm2/processes/:name/logs?lines=100` — get latest logs.
- `GET /api/pm2/processes/:name/logs/stream` — SSE live log stream.

### Database

- `GET /api/database/status` — status of PostgreSQL, MySQL, Redis.
- `POST /api/database/postgres/create` — create DB & user.
- `POST /api/database/postgres/drop` — drop DB.
- `GET /api/database/postgres/list` — list Postgres DBs and users.
- `POST /api/database/mysql/create` — create MySQL DB & user.
- `GET /api/database/mysql/list` — list MySQL DBs.
- `POST /api/database/redis/flush` — flush Redis.

### Terminal

- WebSocket endpoint: `/ws/terminal?token=<jwt>`
  - Uses `node-pty` to spawn `/bin/bash`.
  - Raw terminal data is sent in both directions.
  - Supports resize messages: `{ "type": "resize", "cols": 80, "rows": 24 }`.

## Frontend

The frontend is a React 18 + Vite app located in `client/`:

- Routing with React Router v6 (`/`, `/packages`, `/domains`, `/processes`, `/database`, `/terminal`, `/settings`, `/login`).
- Global dark theme matching a terminal aesthetic.
- JWT stored in `localStorage` and attached via Axios interceptor.
- Real-time SSE usage for package installs and PM2 logs.
- WebSocket terminal based on `xterm.js`.

## Security notes

- All sensitive operations are behind JWT auth.
- The shared `SECRET_TOKEN` is only used for the very first login; treat it like a root password.
- Use strong firewall rules (e.g. `ufw`) and limit who can reach the panel port.
- Run ServerDock only on trusted servers; many actions rely on system tools (`apt`, `systemctl`, `pm2`, `psql`, `mysql`, `redis-cli`, `nginx`, `certbot`) executed with high privileges.

## Updating ServerDock

On the server:

```bash
cd /opt/serverdock
git pull
npm install
pm2 restart serverdock
```

## Uninstall

To stop the panel:

```bash
pm2 delete serverdock
```

To remove files:

```bash
rm -rf /opt/serverdock
```

