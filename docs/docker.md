# Docker Compose

The stack is split across several Compose files so the **base** project file stays limited to **backend** and **frontend** (for image-only or external-database deployments). PostgreSQL and E2E extras are optional overlays.

## Files

| File | Contents |
|------|----------|
| `docker-compose.yml` | **Backend** and **frontend** only. No database. Backend does not `depends_on` Postgres; it uses `POSTGRES_HOST` (and related vars) from `.env`. |
| `docker-compose.local.yml` | **PostgreSQL 16** (Alpine), volume `pgdata`, optional host port `POSTGRES_EXPOSE_PORT`. Extends **backend** with `depends_on: postgres` (wait for health). |
| `docker-compose.e2e.yml` | **MinIO** + one-shot **minio-init** (create bucket). Extends **backend** with `depends_on: minio-init` (wait for successful exit). Intended together with **local** so Postgres and S3 are both present. |

Compose **merges** `backend.depends_on` across files: with base + local + e2e, the backend waits for **Postgres (healthy)** and **minio-init (completed)**.

## Full stack locally (app + Postgres)

From the repository root, with `.env` filled (including `POSTGRES_PASSWORD`, `POSTGRES_HOST=postgres`, S3 credentials for real storage or MinIO if you add the e2e overlay):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Stop and remove containers (keep Postgres data in volume unless you add `-v`):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

## Base stack only (external Postgres)

Use when the database runs outside Compose (managed service, another host, etc.). Set `POSTGRES_HOST` (and port/user/password/DB) in `.env` to that instance — **not** the hostname `postgres`.

```bash
docker compose -f docker-compose.yml up -d --build
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
