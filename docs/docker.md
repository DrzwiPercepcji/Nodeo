# Docker Compose

The stack is split across several Compose files. The **base** file pulls **pre-built images** from GitHub Container Registry (`latest`). **Local** overlay adds PostgreSQL, **Redis** (for optional stream caching), and **`build:`** so you develop from source without changing the base file.

## Images and tags

| Tag | Meaning |
|-----|---------|
| `latest-dev` | Built and pushed automatically on push to `master`/`main` after CI + E2E succeed (`.github/workflows/ci.yml`). Moves with every green merge. |
| `sha-<full git SHA>` | Immutable tag for the same build as that run (full 40-character commit). Safe to pin in production (e.g. `…-backend:sha-abc…`). |
| `sha-<7 chars>` | Same image, short prefix (convenience). Rare SHA collisions possible in theory; prefer full `sha-<40>` or digest for strict pins. |
| `latest` | Production-style tag: run **Promote Docker images (latest-dev → latest)** in Actions. Copies the current `latest-dev` manifest to `latest` (no rebuild). Until the first promotion, use `…:latest-dev` or a `sha-*` tag. |

Each pushed image includes **OCI annotations** (view in GitHub Packages or `docker inspect … --format '{{json .Config.Labels}}'`): `org.opencontainers.image.source`, `revision` (full SHA), `ref.name` (branch), `created` (build UTC time), `title`, `description`, `url`, `documentation`, `version` (`sha-<7>`), `licenses` (`MIT`).

Default image names (lowercase GHCR convention) for [DrzwiPercepcji/Nodeo](https://github.com/DrzwiPercepcji/Nodeo):

- `ghcr.io/drzwipercepcji/nodeo-backend:latest`
- `ghcr.io/drzwipercepcji/nodeo-frontend:latest`

Override with environment variables `NODEO_BACKEND_IMAGE` and `NODEO_FRONTEND_IMAGE` if you use a fork or mirror.

Private packages: run `docker login ghcr.io` before `docker compose pull` / `up`.

## Files

| File | Contents |
|------|----------|
| `docker-compose.yml` | **Backend** and **frontend** only, **`image:`** to GHCR `latest` (defaults above). No database; `POSTGRES_HOST` comes from `.env`. **Backend** uses named volume **`nodeo_backend_tmp`** → `/data/nodeo-tmp` and sets **`NODEO_TEMP_DIR`** so uploads/transcode scratch can be wiped with `docker volume rm …` or by clearing the mount. |
| `docker-compose.local.yml` | **PostgreSQL 16** (Alpine), volume `pgdata`, optional host port `POSTGRES_EXPOSE_PORT`. **Redis 7** (for optional stream cache; set **`REDIS_URL=redis://redis:6379`** in `.env` to enable — omit **`REDIS_URL`** to leave caching off). Optional logical DB: **`redis://…/1`** or **`REDIS_DB=1`**. **`build: ./backend`** and **`build: ./frontend`**. Extends **backend** with `depends_on: postgres` (wait for health). |
| `docker-compose.e2e.yml` | **MinIO** + one-shot **minio-init** (create bucket). Extends **backend** with `depends_on: minio-init` (wait for successful exit). Intended together with **local** so Postgres and S3 are both present. |

Compose **merges** `backend.depends_on` across files: with base + local + e2e, the backend waits for **Postgres (healthy)** and **minio-init (completed)**.

## Backend container: temp volume and user

The **backend** image runs an **entrypoint** (`docker-entrypoint.sh`) as root long enough to `chown` **`NODEO_TEMP_DIR`** (default in Compose: `/data/nodeo-tmp`) to the unprivileged **`node`** user, then starts the app as **`node`**. That way the named volume for uploads/transcode scratch is writable. To clear temp files: remove paths under that directory or recreate the volume (`docker volume rm …` when safe).

## Optional Redis stream cache

- Caching is **off** unless **`REDIS_URL`** is set in `.env` (the Redis service in `docker-compose.local.yml` does not enable it by itself).
- Cached values are **plaintext media bytes** for a given `(mediaId, byte range)` — treat Redis like sensitive memory; use **password/TLS** URLs in production if needed.
- **`REDIS_DB`** or a path in the URL (`redis://host:6379/1`) selects the logical database. See `.env.example`.

## Full stack locally (app + Postgres, build from source)

From the repository root, with `.env` filled (including `POSTGRES_PASSWORD`, `POSTGRES_HOST=postgres`, S3 credentials for real storage or MinIO if you add the e2e overlay):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Stop and remove containers (keep Postgres data in volume unless you add `-v`):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

## Base stack only (pull pre-built images, external Postgres)

Use when the database runs outside Compose (managed service, another host, etc.). Set `POSTGRES_HOST` (and port/user/password/DB) in `.env` to that instance — **not** the hostname `postgres`. No local clone with Dockerfiles required if you only need runtime config:

```bash
docker compose -f docker-compose.yml up -d
```

## E2E stack (Postgres + MinIO + app)

End-to-end tests need a database **and** S3-compatible storage. Use **all three** files (order matters for overrides):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.e2e.yml up -d --build
```

Align `.env` with MinIO (see `docs/e2e.md` and `.github/workflows/ci.yml`), typically:

- `POSTGRES_HOST=postgres`
- `S3_ENDPOINT=http://minio:9000`
- `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` matching the values MinIO is started with (defaults exist in `docker-compose.e2e.yml` if unset).

Tear down including named volumes (Postgres + MinIO data):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.e2e.yml down -v --remove-orphans
```

## Health check

Through the frontend proxy (default `FRONTEND_PORT=8080`):

```bash
curl -sf http://127.0.0.1:8080/api/health
```
