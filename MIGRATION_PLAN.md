# Nodeo — Migration Plan

> Private self-hosted media streaming service with per-collection encryption and S3 storage.

## Current State (Legacy)

| Area | Technology | Issues |
|------|-----------|--------|
| Backend | Node.js + Express + Mustache (SSR) | Hard-coded secrets, sync bcrypt, no env config |
| Frontend | jQuery + Bulma (CDN) | No SPA, no component library, mixed HTTP/HTTPS |
| Database | MongoDB (Mongoose) | No migrations, loose schema |
| Storage | Local filesystem | No cloud, plaintext files left after encryption |
| Encryption | AES-128-ECB, hard-coded key | ECB mode leaks patterns, no auth (HMAC), single global key |
| Auth | Passport + sessions | Hard-coded session secret, no JWT |
| Docker | Single app + mongo containers | No frontend container, no env config |

## Target Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Backend** | Node.js 20+ / Express | Proven, low RAM (~30-50 MB idle), huge ecosystem |
| **Frontend** | Vue 3 + Vite + PrimeVue | Lightweight SPA, rich component library, good DX |
| **Database** | PostgreSQL + `pg` driver | Reliable, SQL migrations, user requirement |
| **Storage** | AWS S3 (`@aws-sdk/client-s3`) | User requirement, cheap, durable |
| **Encryption** | AES-256-CTR + PBKDF2 | Stream cipher (seekable), strong key derivation |
| **Auth** | JWT (`jsonwebtoken`) | Stateless, 3-month expiry, single user from env |
| **Transcoding** | ffmpeg (`fluent-ffmpeg`) | Industry standard, Alpine-compatible |
| **Docker** | 2 containers: backend (Node) + frontend (Nginx + Vue SPA) | Clean separation, user requirement |

### Encryption Design

```
User passphrase
       │
       ▼
   PBKDF2 (100k iterations, random salt)
       │
       ▼
   KEK (Key Encryption Key, 256-bit)
       │
       ▼
   Decrypt encrypted_dek from DB
       │
       ▼
   DEK (Data Encryption Key, 256-bit)  ← cached in memory for 1 hour
       │
       ▼
   AES-256-CTR encrypt/decrypt media files
```

- **Unencrypted collections**: files stored as-is on S3, no passphrase needed.
- **Encrypted collections**: random DEK generated on creation, wrapped with passphrase-derived KEK, stored in PostgreSQL. S3 never sees keys.
- **AES-256-CTR**: counter mode allows random access (seeking in video). For each file, a random 16-byte IV is stored in the DB.
- **Verification**: a known verification token is encrypted with the DEK and stored alongside — used to check if passphrase is correct without exposing the key.

### Project Structure

```
nodeo/
├── docker-compose.yml
├── docker-compose.local.yml
├── docker-compose.e2e.yml
├── .env.example
├── MIGRATION_PLAN.md
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js              # Entry point
│       ├── config.js             # Env-based configuration
│       ├── db/
│       │   ├── pool.js           # pg pool
│       │   └── migrations/       # SQL migration files
│       ├── middleware/
│       │   └── auth.js           # JWT verification
│       ├── routes/
│       │   ├── auth.js           # POST /api/auth/login
│       │   ├── collections.js    # CRUD /api/collections
│       │   └── media.js          # Upload, stream, metadata
│       └── services/
│           ├── encryption.js     # AES-256-CTR, PBKDF2, key wrapping
│           ├── s3.js             # S3 upload/download
│           ├── transcoding.js    # ffmpeg profiles
│           └── keyCache.js       # In-memory DEK cache (1h TTL)
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── public/
│   │   └── logo.svg              # Brand logo (from original project)
│   └── src/
│       ├── App.vue
│       ├── main.ts
│       ├── router/index.ts
│       ├── stores/               # Pinia stores
│       ├── views/                # Page components
│       ├── components/           # Reusable components
│       └── api/index.ts          # openapi-fetch client
```

### Database Schema (PostgreSQL)

```sql
-- Collections (folders)
CREATE TABLE collections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    description   TEXT,
    is_encrypted  BOOLEAN NOT NULL DEFAULT false,
    encrypted_dek BYTEA,            -- DEK encrypted with KEK (null if not encrypted)
    dek_salt      BYTEA,            -- PBKDF2 salt for KEK derivation
    dek_iv        BYTEA,            -- IV used to encrypt the DEK
    verify_token  BYTEA,            -- encrypted known value for passphrase verification
    cover_url     TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Media files (video for now, audio later)
CREATE TABLE media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    title           VARCHAR(300) NOT NULL,
    description     TEXT,
    media_type      VARCHAR(10) NOT NULL DEFAULT 'video',  -- 'video' | 'audio'
    duration_sec    INTEGER,
    file_size_bytes BIGINT,
    s3_key          TEXT NOT NULL,                          -- path in S3 bucket
    encryption_iv   BYTEA,                                 -- per-file IV for AES-CTR
    profile         VARCHAR(20) NOT NULL DEFAULT '720p',   -- encoding profile used
    mime_type       VARCHAR(50),
    thumbnails      JSONB,        -- [{ "s3_key", "encryption_iv" | null }, ...] preview frames
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

### Transcoding Profiles

| Profile | Resolution | FPS | Video Bitrate | Audio | Use Case |
|---------|-----------|-----|--------------|-------|----------|
| `480p`  | 854×480   | 30  | 1.5 Mbps     | 128k AAC | Mobile / slow connection |
| `720p`  | 1280×720  | 30  | 3 Mbps       | 192k AAC | Default / abroad |
| `1080p` | 1920×1080 | 30  | 6 Mbps       | 192k AAC | Home / good connection |
| `1080p60` | 1920×1080 | 60 | 8 Mbps      | 192k AAC | High quality |

### Docker Compose Configuration

```yaml
# Configured via .env file:
# - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
# - S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY
# - AUTH_USERNAME, AUTH_PASSWORD_HASH (bcrypt)
# - JWT_SECRET
# - BACKEND_PORT (default 3000)
```

---

## Implementation Phases

### Phase 1 — Project Scaffolding & Database `[commit 1]` ✓

- [x] Analyze legacy project
- [x] Legacy prototype code removed; logo kept at `frontend/public/logo.svg`
- [x] Initialize backend (Express, `pg`, config from env)
- [x] Initialize frontend (Vue 3 + Vite + PrimeVue + Pinia + Vue Router)
- [x] Create `docker-compose.yml` (backend + frontend); `docker-compose.local.yml` (Postgres); `docker-compose.e2e.yml` (MinIO for E2E)
- [x] Create `.env.example` with all required variables
- [x] Create database migration (collections + media tables)
- [x] Run migrations on startup
- [x] Basic health-check endpoint

### Phase 2 — Authentication `[commit 2]` ✓

- [x] Backend: `POST /api/auth/login` — validate against env credentials, return JWT (90-day expiry)
- [x] Backend: `GET /api/auth/me` — verify JWT, return user info
- [x] Backend: Auth middleware for protected routes
- [x] Frontend: Login page (logo + form only)
- [x] Frontend: JWT storage, openapi-fetch interceptor, auth guard on router
- [x] Frontend: Auto-redirect to login when token expires
- [x] OpenAPI spec + generated TypeScript client (`openapi-fetch` + `openapi-typescript`)
- [x] Backend migrated to TypeScript

### Phase 3 — Collections `[commit 3]` ✓

- [x] Backend: CRUD for collections (`/api/collections`)
- [x] Backend: Collection passphrase unlock endpoint — PBKDF2 → decrypt DEK → cache 1 hour
- [x] Backend: Encryption service (key generation, wrapping, unwrapping, verification)
- [x] Backend: Key cache service (in-memory Map with TTL)
- [x] Frontend: Collections grid (cards/tiles view)
- [x] Frontend: Create/edit collection dialog (name, description, optional passphrase)
- [x] Frontend: Passphrase dialog for encrypted collections
- [x] Frontend: Visual indicator for locked/unlocked collections

### Phase 4+5 — Video Upload, Streaming & Playback `[commit 4]` ✓

- [x] Backend: S3 service (upload, download, range streaming)
- [x] Backend: Upload endpoint with multipart handling (`multer`)
- [x] Backend: ffmpeg transcoding service with configurable profiles (480p/720p/1080p/1080p60)
- [x] Backend: Encrypt-then-upload pipeline (AES-256-CTR → S3)
- [x] Backend: Thumbnail generation and upload to S3
- [x] Backend: Upload progress tracking (XHR progress + status polling)
- [x] Backend: Stream endpoint — S3 range fetch → AES-CTR decrypt → HTTP response
- [x] Backend: Thumbnail endpoint — S3 fetch → response
- [x] Backend: Range request support (block-aligned CTR counter computation)
- [x] Backend: Auth via query param `?token=` for `<video>` src compatibility
- [x] Frontend: Upload dialog with file picker, metadata form, profile selector
- [x] Frontend: Upload progress bar + processing status polling
- [x] Frontend: Collection detail view with media grid
- [x] Frontend: Video player page (HTML5 `<video>` with stream source)
- [x] Frontend: Navigation: collections → collection detail → player

### Phase 6 — Polish & Hardening `[commit 6]` ✅

- [x] Security: helmet (HTTP headers), rate limiting on auth (5 req/15min), configurable CORS
- [x] Input validation: lightweight middleware with field rules (required, maxLength, oneOf)
- [x] Async error handling: asyncHandler wrapper on all async routes
- [x] Error responses: dev mode shows error messages, production shows generic 500
- [x] Reusable AppTopbar component (dark mode toggle, logout, responsive)
- [x] Dark mode: toggle button + localStorage persistence via Pinia store
- [x] Responsive: mobile-friendly topbar, collection grid, media grid
- [x] README: comprehensive setup instructions, architecture table, config reference

### Phase 7 — Music / Audio Support `[commit 7]` ✅

- [x] Audio transcoding profiles: MP3 128/192/320 kbps, AAC 256 kbps
- [x] Auto-detect audio vs video on upload (by MIME type and file extension)
- [x] Audio files skip video transcoding and thumbnail generation
- [x] Video thumbnails: up to 5 JPEG frames along the timeline; encrypted collections store `.enc` blobs on S3 with per-frame IV; `GET /media/:id/thumb?i=` serves decrypted JPEG; hover filmstrip on collection grid when `thumb_frame_count > 1`
- [x] Correct Content-Type for audio streaming (audio/mpeg, audio/mp4)
- [x] Upload dialog: accepts audio/*, shows audio-specific profile options
- [x] Audio player in PlayerView (HTML5 `<audio>`, centered layout with icon)
- [x] Audio icon in collection grid (headphones instead of video thumbnail)

### Future

- [x] **Linting (baseline)** — Backend: ESLint 9 + `typescript-eslint` (`recommended`). Frontend: Oxlint (correctness) + ESLint with `eslint-plugin-vue` `flat/recommended` and TypeScript recommended; generated `schema.d.ts` ignored. Run `npm run lint` in each package.
- [x] **CI/CD (GitHub Actions) — baseline** — `.github/workflows/ci.yml` runs on every PR and push to `master`/`main`: backend `lint` + `typecheck` + `test` (Vitest), frontend `lint` + `type-check` + `build-only` (Node 24).
- [x] **CI/CD — extend** — E2E: Playwright + Cucumber (Gherkin, English scenarios), job in `.github/workflows/ci.yml` brings up `docker compose` with `docker-compose.yml` + `docker-compose.local.yml` + `docker-compose.e2e.yml`, `e2e/fixtures` (optional `sample.mp3` / `sample.mp4`; CI generates tiny files via ffmpeg if missing). See `docs/e2e.md`, `docs/docker.md`. Frontend unit tests still optional.
- [x] **Backend unit tests (Vitest)** — `backend/test/*.test.ts`: encryption (derive, wrap/unwrap DEK, CTR counter, stream decipher at aligned offset), `KeyCache` TTL with fake timers, `validateFields`, transcoding helpers (`detectMediaType`, output mime/extension, profile maps). Run `npm run test` in `backend/`.
- [ ] **Frontend unit / E2E (GHA)** — E2E in GHA is covered above. Still missing: Vitest + Vue Test Utils in `frontend/` (unit tests); coverage thresholds optional.
- [ ] **Refactor toward classes / service modules** — In progress: cohesive pieces live in `backend/src/services/` (`encryption`, `s3`, `transcoding`, `keyCache`, `processingProgress`), but route files still own a lot of orchestration (notably `routes/media.ts`). Not considered complete until extraction matches the plan.
- [x] **Collection as playlist** — Implemented: `PlaylistView.vue` at `/collections/:id/playlist` — ordered audio queue, auto-advance on track end, shuffle, repeat modes (off / all / one), large transport controls and queue list for mobile / in-car use.
- [ ] **Docker images via GHA** — Partially implemented: after a successful E2E job, push to **GHCR** on `master`/`main` as `…-backend:latest-dev` and `…-frontend:latest-dev` (`linux/amd64`, OCI labels for source + revision). Still open vs. the full goal: semver and/or `git` SHA tags, and a sample `docker-compose` override using only `image:` (no local build).
- [ ] Audio cover art extraction from ID3 tags

---

## Configuration Reference (`.env`)

```env
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=nodeo
POSTGRES_USER=nodeo
POSTGRES_PASSWORD=changeme

# S3
S3_BUCKET=my-nodeo-bucket
S3_REGION=eu-central-1
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=secret...
S3_ENDPOINT=                    # optional, for S3-compatible storage

# Auth (single user)
AUTH_USERNAME=admin
AUTH_PASSWORD_HASH=$2b$12$...   # bcrypt hash

# Security
JWT_SECRET=generate-a-random-secret-here

# Backend
BACKEND_PORT=3000
NODE_ENV=production

# Frontend (build-time)
VITE_API_URL=http://localhost:3000/api
```

---

## Key Decisions & Trade-offs

1. **Full rewrite vs. incremental migration**: Full rewrite chosen — the old codebase is small (~25 files) and nearly everything changes (DB, frontend, storage, encryption, auth).
2. **Express over Fastify**: Express is more widely known and simpler to maintain. Both are lightweight on Node.js; the RAM difference is negligible.
3. **Raw `pg` over ORM**: For ~2 tables, raw SQL is more transparent and has zero abstraction overhead. Migrations are plain `.sql` files.
4. **AES-256-CTR over AES-GCM**: CTR is simpler for streaming large files with range requests. GCM would add authentication but complicates random-access decryption of multi-GB files. Integrity is ensured by S3's own checksums for storage corruption.
5. **JWT over sessions**: Stateless auth simplifies the backend (no session store needed). Single user = minimal attack surface.
6. **Video only first**: Audio support deferred to keep initial scope manageable.
