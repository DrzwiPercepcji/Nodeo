# Nodeo

Private self-hosted media streaming service with per-collection encryption and S3 storage.

## Features

- **Single-user auth** — JWT with 90-day sessions, credentials from env
- **Collections** — organize media into folders, each optionally encrypted
- **Per-collection encryption** — AES-256-CTR with PBKDF2-derived keys; AWS never sees your keys
- **Video & audio** — upload with ffmpeg transcoding (video profiles 480p–1080p60; audio MP3/AAC profiles)
- **Metadata** — ID3 / container tags from the **source file** (ffprobe) stored as `media.metadata`; shown in the UI (grid, player, audio playlist)
- **Audio playlist** — per-collection queue with shuffle and repeat (mobile-friendly)
- **Encrypted streaming** — HTTP range requests with seekable CTR decryption
- **Optional Redis stream cache** — caches plaintext byte ranges for repeat range requests (off unless `REDIS_URL` is set); see [.env.example](.env.example) and [docs/docker.md](docs/docker.md)
- **S3 storage** — any S3-compatible backend (AWS, MinIO, etc.)
- **Dark mode** — toggle with persistent preference
- **Docker Compose** — base file pulls **GHCR** images (`latest`); `docker-compose.local.yml` adds PostgreSQL, **Redis**, and **builds** backend/frontend from source; backend temp dir on a **named volume** (see [docs/docker.md](docs/docker.md))

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
| Cache (optional) | Redis 7 (`redis` npm client v5) — media stream range cache only |
| Encryption | AES-256-CTR + PBKDF2 key derivation |
| Auth | JWT (stateless, 90-day expiry) |
| API contract | OpenAPI 3.0 spec → `openapi-typescript` + `openapi-fetch` |
| Docker | Base: backend + frontend images; local overlay adds Postgres + Redis + `build:`; backend uses volume for `NODEO_TEMP_DIR` |

See [docs/migration-history.md](docs/migration-history.md) for the completed rewrite timeline, SQL migrations, and design rationale (archived from the old migration plan).

## Documentation

| Document | Contents |
|----------|----------|
| [docs/docker.md](docs/docker.md) | Compose files, GHCR tags, Postgres/Redis, temp volume, optional stream cache, E2E stack commands |
| [docs/e2e.md](docs/e2e.md) | Playwright + Cucumber setup, fixtures, local runs |
| [docs/infra.md](docs/infra.md) | AWS S3 / IAM / lifecycle (Terraform & CloudFormation) |
| [docs/migration-history.md](docs/migration-history.md) | Completed rewrite phases, DB migration list, encryption & trade-offs (archive) |
| [.env.example](.env.example) | All environment variables with comments |

## Configuration

All configuration is via `.env` — see [.env.example](.env.example) for every variable and inline comments.

**Required (core):** `POSTGRES_*`, `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `JWT_SECRET`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.

**Common optional:**

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT` | S3-compatible API URL (e.g. MinIO) |
| `S3_STORAGE_CLASS` | AWS storage class; omit for MinIO |
| `CORS_ORIGIN` | Browser origin(s); default `*` |
| `BACKEND_PORT` / `FRONTEND_PORT` | Published ports (defaults 3000 / 8080) |
| `NODEO_TEMP_DIR` | Upload/transcode scratch (Compose sets `/data/nodeo-tmp` + volume; see [docs/docker.md](docs/docker.md)) |
| `REDIS_URL` | If set, enables **stream range cache** (plaintext in Redis; use TLS/password URL in production) |
| `REDIS_DB` | Logical Redis DB index (or use `redis://host:6379/1` in `REDIS_URL`) |
| `STREAM_CACHE_TTL_SECONDS` | Cache TTL (default 1800) |
| `STREAM_CACHE_MAX_RANGE_BYTES` | Max cached range size per key (default 8 MiB) |
| `POSTGRES_EXPOSE_PORT` / `REDIS_EXPOSE_PORT` | Host ports when using `docker-compose.local.yml` |

## License

MIT
