# Kayee01 E-commerce Platform

Full-stack luxury e-commerce store: **React (CRA + CRACO)** frontend, **FastAPI + Motor** backend, **MongoDB** database. Frontend deploys to Vercel/Render, backend to Render.

## Cursor Cloud specific instructions

### Services and how to run them (local dev)
Three services must run for end-to-end work:

| Service | Directory | Run command | Port |
|---------|-----------|-------------|------|
| MongoDB | n/a | `mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017` | 27017 |
| Backend (FastAPI) | `backend/` | `./venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000` | 8000 |
| Frontend (CRA/CRACO) | `frontend/` | `yarn start` | 3000 |

Notes / gotchas:
- The backend uses a **Python venv at `backend/venv`** (system Python is externally managed, so a venv is required). Run backend commands via `./venv/bin/...`.
- Backend is **not** started with `--reload`; after editing backend code you must restart the uvicorn process for changes to take effect. (The README's `python server.py` does not work — `server.py` has no `__main__` block; always use uvicorn.)
- Backend reads `backend/.env` (git-ignored). Minimum for local dev: `MONGO_URL=mongodb://localhost:27017`, `DB_NAME=kayee01_db`, `JWT_SECRET_KEY=...`, `FRONTEND_URL=http://localhost:3000`, `CORS_ORIGINS=http://localhost:3000`.
- Frontend needs `REACT_APP_BACKEND_URL` (no trailing `/api`) — set in `frontend/.env.local` (git-ignored) to `http://localhost:8000` for local dev. The app builds the API base as `${REACT_APP_BACKEND_URL}/api`.
- `bcrypt`/`passlib` print a harmless `error reading bcrypt version` warning on startup and in seed scripts; hashing still works.

### Seeding data
- `cd backend && ./venv/bin/python init_db.py` — wipes and seeds categories + 9 sample products + a demo admin.
- `cd backend && ./venv/bin/python create_admin.py` — creates/updates the real admin. Env must be loaded (it uses `python-dotenv`). Admin login: `kayicom509@gmail.com` / `Admin123!` at `/admin/login`.
- `init_db.py` does NOT load `.env`; export env first (e.g. `set -a && . ./.env && set +a`) or it falls back to `test_database`.

### Lint / build / test
- Frontend lint + compile check: `cd frontend && CI=false yarn build` (CRA runs `eslint-config-react-app` during build). No standalone flat ESLint config exists, so `npx eslint` won't work.
- Backend has `flake8`/`black`/`pytest` installed. Quick sanity: `./venv/bin/python -m flake8 server.py --select=E9,F63,F7,F82`.
- `tests/` and `debug_orders.py` exist but there is no configured automated test suite wired to CI.

### Admin-configurable WhatsApp support
The floating WhatsApp widget, footer "WhatsApp Support" link, and order-success contact link are driven by admin settings (up to 3 buttons), not hardcoded numbers. Managed under **Admin > Settings > WhatsApp**. API: `GET /api/settings/whatsapp` (public), `GET|PUT /api/admin/settings/whatsapp` (admin). Config is stored in the `admin_settings` Mongo document under the `whatsapp` key. Shared frontend helper: `frontend/src/lib/whatsapp.js`.

### Deployment note
Production frontend (`frontend/.env.production`, `render.yaml`) points `REACT_APP_BACKEND_URL` at `https://kayee01-backend.onrender.com`. If the storefront shows no products in production, first verify that Render backend host actually resolves to a running service (a `x-render-routing: no-server` response / 404 means the backend service is down or the URL is stale) and that its `MONGO_URL` points at the populated Atlas database.
