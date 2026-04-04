# Nodeo

Private self-hosted media streaming service with per-collection encryption and S3 storage.

## Features

- **Single-user auth** — JWT with 90-day sessions, credentials from env
- **Collections** — organize media into folders, each optionally encrypted
- **Per-collection encryption** — AES-256-CTR with PBKDF2-derived keys; AWS never sees your keys
- **Video upload** — transcoding to multiple profiles (480p/720p/1080p/1080p60) via ffmpeg
- **Encrypted streaming** — range-request support with seekable CTR decryption
- **S3 storage** — any S3-compatible backend (AWS, MinIO, etc.)
- **Dark mode** — toggle with persistent preference
- **Docker Compose** — base file pulls **GHCR** images (`latest`); `docker-compose.local.yml` adds PostgreSQL and **builds** backend/frontend from source (see [docs/docker.md](docs/docker.md))

## Quick Start

### 1. Provision S3

See [docs/infra.md](docs/infra.md) for Terraform / CloudFormation setup.

### 2. Configure

```bash
cp .env.example .env
```

Generate secrets (run from `backend/`):

```bash
cd backend

# Password hash
node -e "console.log(require('bcryptjs').hashSync('your-password', 12))"

# JWT secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Bcrypt hash in `.env`:** Docker Compose treats `$` as variable interpolation. Double every `$` in `AUTH_PASSWORD_HASH` (e.g. `$2a$12$...` → `$$2a$$12$$...`), or login will always fail with "invalid credentials".

Fill in `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` from your S3 setup.

### 3. Run

**Local stack with Postgres** (typical):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

**Backend + frontend only** (pull pre-built images; Postgres elsewhere — set `POSTGRES_HOST` in `.env`):

```bash
docker compose -f docker-compose.yml up -d
```

CI publishes `latest-dev` on each merge; promote to `latest` with GitHub Actions → **Promote Docker images (latest-dev → latest)** so `docker compose` pulls stable tags.

See [docs/docker.md](docs/docker.md) for E2E (MinIO) and teardown. Open `http://localhost:8080` and log in.

## Development

```bash
# Start Postgres
docker run -d --name nodeo-pg \
  -e POSTGRES_DB=nodeo -e POSTGRES_USER=nodeo -e POSTGRES_PASSWORD=changeme \
  -p 5432:5432 postgres:16-alpine

# Backend (terminal 1)
cd backend && npm install && npm run dev

# Frontend (terminal 2)
cd frontend && npm install && npm run dev
```

Set `POSTGRES_HOST=localhost` in `.env` for local dev.

The frontend dev server proxies `/api` requests to `http://localhost:3000`.

### Regenerate API types

After changing `backend/src/openapi.yaml`:

```bash
cd frontend && npm run api:generate
```

### Lint

```bash
cd backend && npm run lint
cd frontend && npm run lint   # Oxlint + ESLint (Vue recommended + TypeScript)
```

On GitHub, workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the same checks on every push and pull request targeting `master` or `main`.

## Architecture

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 24 + Express + TypeScript |
| Frontend | Vue 3 + Vite + PrimeVue + Pinia |
| Database | PostgreSQL (raw `pg`, SQL migrations) |
| Storage | AWS S3 / S3-compatible |
| Encryption | AES-256-CTR + PBKDF2 key derivation |
| Auth | JWT (stateless, 90-day expiry) |
| API contract | OpenAPI 3.0 spec → `openapi-typescript` + `openapi-fetch` |
| Docker | 2 containers (Node backend + Nginx frontend) |

See [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for detailed architecture and roadmap.

## Configuration

All configuration is via `.env` — see [.env.example](.env.example) for all available variables.

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_HOST` | yes | Database host |
| `POSTGRES_DB` | yes | Database name |
| `POSTGRES_USER` | yes | Database user |
| `POSTGRES_PASSWORD` | yes | Database password |
| `AUTH_USERNAME` | yes | Login username |
| `AUTH_PASSWORD_HASH` | yes | Bcrypt hash (escape `$` as `$$`) |
| `JWT_SECRET` | yes | Random secret for signing tokens |
| `S3_BUCKET` | yes | S3 bucket name |
| `S3_REGION` | yes | AWS region |
| `S3_ACCESS_KEY` | yes | IAM access key |
| `S3_SECRET_KEY` | yes | IAM secret key |
| `S3_ENDPOINT` | no | Custom S3 endpoint (MinIO, etc.) |
| `S3_STORAGE_CLASS` | no | e.g. `INTELLIGENT_TIERING` on AWS; omit for MinIO |
| `CORS_ORIGIN` | no | CORS origin (default: `*`) |
| `BACKEND_PORT` | no | Backend port (default: 3000) |
| `FRONTEND_PORT` | no | Frontend port (default: 8080) |

## License

MIT
