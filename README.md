# Nodeo

Private self-hosted media streaming service with per-collection encryption and S3 storage.

## Quick Start

1. Copy and configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your values (Postgres, S3, auth credentials)
   ```

   **Bcrypt hash in `.env`:** Docker Compose treats `$` as variable interpolation. Double every `$` in `AUTH_PASSWORD_HASH` (e.g. `$2a$12$...` → `$$2a$$12$$...`), or login will always fail with “invalid credentials”.

2. Generate password hash and JWT secret (run from `backend/` so `bcryptjs` resolves):
   ```bash
   cd backend

   # Password hash
   node -e "console.log(require('bcryptjs').hashSync('your-password', 12))"

   # JWT secret
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   If you prefer dynamic `import`, bcryptjs exposes the API on `default`:
   ```bash
   node -e "import('bcryptjs').then(m => console.log(m.default.hashSync('your-password', 12)))"
   ```

3. Start with Docker Compose:
   ```bash
   docker compose up -d
   ```

4. Open `http://localhost:8080` and log in.

## Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

The frontend dev server proxies `/api` requests to `http://localhost:3000`.

## Architecture

- **Backend**: Node.js + Express, PostgreSQL, S3
- **Frontend**: Vue 3 + PrimeVue (Nginx in production)
- **Encryption**: AES-256-CTR with per-collection keys (PBKDF2 key derivation)
- **Docker**: 2 app containers (backend + frontend) + PostgreSQL

See [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for detailed architecture and roadmap.
