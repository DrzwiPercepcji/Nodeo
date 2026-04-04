# End-to-end tests (Playwright + Cucumber)

## Docker stack for E2E

E2E needs **Postgres** and **MinIO** as well as backend + frontend. Use three Compose files (see **[docs/docker.md](docker.md)** for details):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.e2e.yml up -d --build
```

The same triple is what the **GitHub Actions** `e2e` job runs.

## What runs

- **Browser automation:** Playwright drives Chromium against the real UI.
- **Scenarios:** Gherkin feature files under `e2e/features/` (`*.feature`). Step implementations are TypeScript in `e2e/steps/`; shared setup lives in `e2e/support/` (`world.ts`, `hooks.ts`).
- **Application under test:** Full stack from Compose: PostgreSQL (`docker-compose.local.yml`), backend API, frontend (nginx + static SPA), MinIO (`docker-compose.e2e.yml`). The frontend talks to the API via `/api` (nginx proxy to the backend container).

## Repository layout (E2E)

| Path | Role |
|------|------|
| `e2e/features/` | Gherkin scenarios (English). |
| `e2e/steps/` | Cucumber step definitions (Playwright selectors and assertions). |
| `e2e/support/hooks.ts` | Launches Chromium, creates a new browser context per scenario, default timeout 6 minutes (upload/processing). |
| `e2e/fixtures/` | Test media files: `sample.mp3`, `sample.mp4` (committed or generated; see below). |
| `e2e/cucumber.mjs` | Cucumber config: feature paths, import order for support then steps. |

Compose file roles are documented in **[docs/docker.md](docker.md)**.

## Local run: prerequisites

1. **Docker** and Docker Compose v2.
2. **Node.js** (project standard: 24.x recommended) on the host for `e2e/` only.
3. **Stack running** with `docker-compose.yml` + `docker-compose.local.yml` + `docker-compose.e2e.yml` (see top of this file and `docs/docker.md`).
4. **Root `.env`** (copy from `.env.example` and fill required variables). For E2E with MinIO you must align **S3** with the overlay:
   - `S3_ENDPOINT=http://minio:9000` (service name `minio` on the Compose network).
   - `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` must match what MinIO is started with. The E2E compose file defaults credentials to `e2eaccess` / `e2esecretkeymustbelongenough123` and bucket `nodeo-e2e` if variables are unset; your `.env` should use the same values for a predictable local setup.
5. **Auth:** Create a user matching the scenarios: username `e2e-admin`, password `e2e-secret`, by setting `AUTH_USERNAME` and a bcrypt `AUTH_PASSWORD_HASH` for `e2e-secret` (see `.env.example` for escaping `$` in Docker `.env` files).

## Local run: commands

Bring the stack up (from repo root):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.e2e.yml up -d --build
```

Wait until the app responds (e.g. `curl -sf http://127.0.0.1:8080/api/health` if `FRONTEND_PORT=8080`).

Install E2E dependencies and Chromium (once per machine / after dependency changes):

```bash
cd e2e
npm install
npx playwright install chromium
```

Run scenarios (default base URL is `http://127.0.0.1:8080`):

```bash
export PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080   # optional if using default
npm test
```

Headed browser (debugging):

```bash
npm run test:headed
```

(`PWHEADLESS=0` is set by that script in `e2e/package.json`.)

### Fixtures (`sample.mp3` / `sample.mp4`)

Scenarios expect files under `e2e/fixtures/`. You can commit your own short MP3/MP4 files with those names. If the files are missing locally, generate minimal ones with **ffmpeg**, for example:

```bash
mkdir -p e2e/fixtures
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=1" -c:a libmp3lame -b:a 128k e2e/fixtures/sample.mp3
ffmpeg -y -f lavfi -i "testsrc=duration=1:size=320x240:rate=25" -c:v libx264 -pix_fmt yuv420p -movflags +faststart e2e/fixtures/sample.mp4
```

## CI pipeline (GitHub Actions)

- **Workflow:** `.github/workflows/ci.yml`, job **`e2e`**.
- **Ordering:** Runs after **`backend`** and **`frontend`** jobs succeed (lint, typecheck, tests, build).
- **`.env` generation:** The job installs backend dependencies, runs Node once to produce a bcrypt hash for password `e2e-secret`, and writes a root `.env` with:
  - Postgres settings, `AUTH_USERNAME=e2e-admin`, generated `AUTH_PASSWORD_HASH`, `JWT_SECRET`, `NODE_ENV=production`, ports.
  - **S3** pointing at MinIO: `S3_ENDPOINT=http://minio:9000`, bucket `nodeo-e2e`, keys aligned with `docker-compose.e2e.yml`.
- **Stack:** `docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.e2e.yml up -d --build`.
- **Readiness:** Polls `http://127.0.0.1:8080/api/health` (through the frontend nginx proxy) up to a few minutes.
- **Fixtures:** Installs **ffmpeg** on the runner; if `e2e/fixtures/sample.mp3` or `sample.mp4` is missing, creates tiny synthetic files (same idea as the local ffmpeg commands above).
- **Tests:** `cd e2e && npm install && npx playwright install chromium --with-deps && npm test` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080`.
- **Cleanup:** `docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.e2e.yml down -v --remove-orphans` always runs at the end; on failure, compose logs are printed for debugging.

## Tags and filtering

Feature tags (e.g. `@audio`, `@video`) are used for optional filtering:

```bash
npx cucumber-js --tags '@audio'
```

(Default `npm test` runs all scenarios.)

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_BASE_URL` | Origin of the SPA (default `http://127.0.0.1:8080`). |
| `PWHEADLESS` | Set to `0` for headed mode (see `npm run test:headed`). |

## Stability notes

- Upload scenarios wait up to **5 minutes** for transcoding and S3 upload to finish (`the media "…" is ready` checks for the audio headphones icon or video thumbnail on the collection grid).
- Login uses the real `/api/auth/login` route; the backend applies a **rate limit** on auth routes—avoid many failed login attempts in quick succession when debugging.
