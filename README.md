# Vivo Cloud frontend

React and Vite frontend for the existing Vivo Cloud Flask server. Work on the frontend and build it on Windows. This project does not deploy files or change the Flask server.

## Environment configuration

`.env.example` is the version-controlled example. `.env.development.local` is your private, ignored Windows development configuration. The address `192.168.1.100` is only a placeholder, not the Vivo's known address.

- `VITE_VIVO_HOST` and `VITE_VIVO_PORT` record the phone's LAN host and Flask port (`5000`).
- `VITE_API_BASE_URL` stays empty in development so the browser uses same-origin relative paths.
- `VITE_DEV_API_TARGET` is the authoritative complete backend URL used by the Vite development proxy.

The API client always uses relative paths. In development, the Vite proxy sends `/api/health` to the Flask `/` health route and forwards `/files`, `/upload`, and `/download/...` at their original paths. `VITE_DEV_API_TARGET` is validated as an HTTP or HTTPS URL before it is used. In production the health check uses `/` and all API paths stay relative to Flask's origin. Vite variables prefixed with `VITE_` are public client-side configuration; never put passwords, keys, tokens, or other secrets in them.

From the frontend project root, copy the example once:

```powershell
Copy-Item .env.example .env.development.local
```

If `.env.development.local` already exists, edit it rather than overwriting it. Find the phone's current LAN IP in its network settings and use that address; do not guess it. The PC and phone need to communicate on the same LAN or another network that explicitly permits traffic between them.

Edit the local file, replacing every occurrence of `YOUR_ACTUAL_VIVO_IP` below with the real IP (do not leave it as literal text):

```dotenv
VITE_VIVO_HOST=YOUR_ACTUAL_VIVO_IP
VITE_VIVO_PORT=5000
VITE_API_BASE_URL=
VITE_DEV_API_TARGET=http://YOUR_ACTUAL_VIVO_IP:5000
```

The Flask port is `5000`. `VITE_API_BASE_URL` stays empty. `VITE_DEV_API_TARGET` provides the full proxy target; `/api/health` is rewritten to Flask `/`, while `/files`, `/upload`, and `/download/...` keep their paths. The dashboard's `/` remains the React app.

## Run on Windows

In PowerShell, from this `frontend` directory:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173/`). Vite reads `.env.development.local` when it starts; restart it after editing the file. The browser API client calls same-origin relative paths, which Vite proxies to Flask.

## Check the backend routes

- `GET /` is the Flask health check when called on Flask (the dashboard's `/` is the React page).
- `GET /api/health` is the Vite development alias for the Flask `GET /` health check.
- `GET /files` lists files.
- `POST /upload` accepts multipart form data with a `file` field.
- `GET /download/<filename>` downloads a file.
- `POST /login` accepts JSON `username` and `password` credentials and establishes a session cookie.
- `POST /logout` clears the authenticated session.
- `DELETE /files/<filename>` deletes a file.

For proxy testing, request `http://localhost:5173/api/health` or `http://localhost:5173/files` while Vite is running. A successful local build does not establish that the phone is reachable; no real-server check is implied by these instructions.

## Login and sessions

On startup, the frontend checks `GET /files` before showing the dashboard. A `401` displays the login form; a network or server error displays a connection error with a retry action. Login posts the entered credentials as JSON to `/login`. API requests include the Flask session cookie, and upload progress uses an XMLHttpRequest with credentials enabled. The dashboard includes `/logout`; the frontend clears its authenticated state only after a successful logout response. A `401` from a protected request returns the user to the login screen. Passwords and session cookies are not stored in frontend environment variables.

## Build

```powershell
npm run build
```

Vite writes production files to `dist/`. The current package scripts are `dev`, `build`, and `preview`; there are no lint or test scripts.

## Deploy later to the Vivo

The intended destination is `~/server/apps/cloud/frontend/dist/`. Deployment is a separate operation and is not performed by this project setup:

1. Build on Windows with `npm run build`.
2. Back up any existing frontend build at the destination.
3. Copy the contents of the generated `dist/` directory to `~/server/apps/cloud/frontend/dist/`.
4. Preserve `~/server/data/files/`, the persistent upload directory.
5. Preserve `~/server/apps/cloud/app.py` and `~/server/apps/cloud/venv/`; leave `~/server/www/` unchanged.
6. Restart Flask only if the eventual static-file serving arrangement requires it, through a separately authorized operation.
7. To roll back, restore the backed-up frontend build to the destination.

The production API uses `/`, `/files`, `/upload`, and `/download/...` relative to the page origin. When Flask serves the built frontend, the browser automatically sends API requests to that same Vivo origin. This keeps the changing LAN IP out of the production JavaScript and requires no Vite proxy or Node.js on the phone. Flask must be configured to serve the frontend build and handle the relevant routes; that server-side work is not included here.

## Security

Authentication is provided by the Flask session cookie. Keep Flask's session secret private and use the service only on a controlled, trusted network. Environment variables and the development proxy do not provide authentication.
