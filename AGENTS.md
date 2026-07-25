# AGENTS.md

## Cursor Cloud specific instructions

Kayee01 is a full-stack e-commerce app made of three services that must all run for local dev:

- MongoDB (port 27017) — data store, DB name `kayee01_db`.
- Backend: FastAPI in `backend/` (port 8001). All routes are under the `/api` prefix.
- Frontend: React (CRA + CRACO) in `frontend/` (port 3000).

The dependency-refresh update script (backend venv + `pip install`, frontend `yarn install`) runs automatically on startup. System deps (MongoDB server, `python3-venv`) and local `.env` files are baked into the VM snapshot, so they are NOT reinstalled/recreated by the update script.

### Starting the services (non-obvious gotchas)

- MongoDB: there is no systemd in this VM, so start it manually, e.g. `mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017`. It must be running before the backend.
- Backend: run `uvicorn server:app --host 0.0.0.0 --port 8001 --reload` from `backend/` with the venv activated (`. backend/.venv/bin/activate`). Do NOT use the README's `python server.py` — `server.py` has no `__main__`/`uvicorn.run` block and will not start a server.
- Frontend: `yarn start` in `frontend/` (this is `craco start`). It reads `REACT_APP_BACKEND_URL` from `frontend/.env` (set to `http://localhost:8001` for local dev).

### Environment files

- `backend/.env` and `frontend/.env` are gitignored and only exist locally (created during environment setup, persisted in the snapshot). Only production templates are committed.
- Payment/email/OAuth keys are optional; they degrade gracefully with placeholders. Catalog, cart, auth, and admin flows work without them.

### Seeding the database

- `backend/init_db.py` (products + categories), `backend/create_admin.py` (README admin), and `backend/create_sample_data.py` (coupons) seed data.
- Gotcha: `init_db.py` does NOT call `load_dotenv`, so run it with `MONGO_URL` and `DB_NAME` exported (otherwise it writes to a `test_database` DB, not `kayee01_db`).
- Admin login: `/admin/login` with `kayicom509@gmail.com` / `Admin123!`.

### Lint / test / build

- Frontend lint runs automatically via `react-scripts` during `yarn start`/`yarn build`. There is no ESLint flat config, so invoking the `eslint` CLI directly (ESLint v9) fails — rely on the build-time lint instead.
- Backend has `flake8`/`black` available (dev deps) but no configured project lint standard.
- There is no automated test suite (only an empty `tests/__init__.py`); `pytest` collects 0 tests.
- A cosmetic `error reading bcrypt version` warning appears from passlib + bcrypt 4.x during hashing; it is harmless and hashing still works.

### Manual testing gotcha (browser)

- During GUI testing, Chrome occasionally shows `Aw, Snap! ... Error code: 4` (a renderer-process crash, not a JS error — a real app error would show the React error overlay instead). This is browser flakiness in the VM, not a server problem. Recover by fully quitting and relaunching Chrome, then reload the same URL. Do NOT restart the dev servers for this; restarting them mid-navigation actually makes it worse.

### Delivery / shipping methods

- Delivery methods are admin-managed (Admin → Settings → "Delivery Methods" tab). They are stored in the `admin_settings` document under `shipping_methods` and exposed via `/api/admin/settings/shipping-methods` (CRUD, admin auth) and the public `/api/settings/shipping-methods` (enabled only; returns a default Free Delivery when none are configured so checkout never breaks). The checkout page loads these dynamically.
