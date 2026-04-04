# Migration history (archived plan)

This document **replaces** the root-level `MIGRATION_PLAN.md` (removed after completion). It records **why** and **how** Nodeo was rebuilt from the legacy app, what shipped in each phase, how the **SQL schema evolved**, and the main **design choices**. For current setup and env vars, use [README.md](../README.md), [.env.example](../.env.example), and [docker.md](docker.md).

---

## 1. Context: legacy vs current

The previous codebase was a small Node stack with **MongoDB**, **local disk** storage, **Passport sessions**, **AES-128-ECB** with a fixed key, and a **jQuery + server-rendered** UI. The goal was a **full rewrite**: PostgreSQL, S3, JWT, modern SPA, and sound cryptography.

| Area | Legacy | Current (as built) |
|------|--------|---------------------|
| Backend | Express + Mustache SSR | **Node.js 24** + **Express** + **TypeScript** |
| Frontend | jQuery + Bulma | **Vue 3** + **Vite** + **PrimeVue** + **Pinia** |
| Database | MongoDB / Mongoose | **PostgreSQL** + **`pg`** + ordered **SQL migrations** |
| Storage | Local filesystem | **S3** (`@aws-sdk/client-s3`, multipart upload) |
| Encryption | AES-128-ECB, global key | **AES-256-CTR** per file, **DEK** per collection, **PBKDF2** KEK, in-memory DEK cache |
| Auth | Sessions | **JWT** (~90-day expiry), single user from env |
| Transcoding | N/A | **ffmpeg** CLI (profiles in `transcoding.ts`) |
| Containers | App + Mongo | **Backend + frontend** images; **Compose overlays** for Postgres, Redis, MinIO (E2E) |

---

## 2. SQL migrations (repository files)

Migrations live in `backend/src/db/migrations/` and run on backend startup.

| File | Purpose |
|------|---------|
| `001_initial.sql` | `collections` + `media` core tables |
| `002_media_status.sql` | `status`, `original_name` on `media` |
| `003_thumbnails_jsonb.sql` | `thumbnails` JSONB (multi-frame previews); drop legacy `thumb_s3_key` |
| `004_media_metadata.sql` | `metadata` JSONB (ffprobe tags from source upload) |

The ERD in the old plan (collections ↔ media, encryption columns) remains the conceptual model; extra columns above reflect iterative delivery.

---

## 3. Implementation phases (completed)

Phases matched the original roadmap; all items below were delivered.

**Phase 1 — Scaffolding & DB**  
Monorepo layout, backend/frontend init, Docker Compose base + local + E2E overlay, `.env.example`, first migration, migrate-on-boot, `/api/health`.

**Phase 2 — Auth**  
`POST /api/auth/login`, `GET /api/auth/me`, JWT middleware, Vue login + guards + openapi-fetch, OpenAPI spec + `openapi-typescript` client, backend TypeScript.

**Phase 3 — Collections**  
Collections CRUD, unlock with passphrase, encryption service (wrap/unwrap DEK, verify token), key cache, Vue grid + dialogs + lock state.

**Phase 4–5 — Video pipeline**  
S3 up/down/range, multer upload, ffmpeg transcode profiles, encrypt-then-upload, thumbnail pipeline, processing progress API, stream + thumb routes with CTR range alignment, Vue upload/detail/player.

**Phase 6 — Hardening & UX**  
Helmet, auth rate limit, CORS, validate middleware, asyncHandler, AppTopbar, dark mode, responsive layout, README baseline.

**Phase 7 — Audio**  
Audio profiles (MP3/AAC), `detectMediaType`, audio skips video thumbs, multi-frame video thumbs + encrypted thumb blobs, correct audio MIME, playlist-friendly UI (headphones, `<audio>` player).

**Post-phase checklist (from “Future”)**  
Lint (ESLint 9 / Oxlint + Vue TS), CI (backend + frontend + E2E with Playwright + Cucumber), Vitest unit tests (encryption, keyCache, validate, transcoding helpers, upload helpers, metadata), frontend store/view tests, **service-oriented backend** (`collections/`, `mediaUpload/`, barrels), **PlaylistView** (shuffle/repeat), **GHCR** build/promote workflows, **media metadata** (ID3/container via ffprobe, `media.metadata`, UI).

---

## 4. Later increments (not in original phase list)

Documented in [README.md](../README.md) and [docker.md](docker.md):

- **Optional Redis** — plaintext byte-range cache for streaming (`REDIS_URL`, `REDIS_DB`, TTL / max range envs).
- **Backend temp dir** — `NODEO_TEMP_DIR`, Compose volume `nodeo_backend_tmp`, Docker **entrypoint** `chown` for user `node`.
- **Redis in local Compose** — service for dev; cache remains opt-in via env.
- **Documentation split** — operational detail moved to `docs/` + expanded README; **configuration** source of truth: `.env.example`.

---

## 5. Encryption model (summary)

Unchanged from the plan:

1. Optional **passphrase** on collection create → random **DEK**; **KEK** from **PBKDF2** (salt); DEK encrypted at rest; **verify token** checks passphrase on unlock.  
2. **Unencrypted collections**: files stored as-is on S3.  
3. **Encrypted collections**: each media file uses **AES-256-CTR** with a random **file IV** in DB; S3 sees only ciphertext.  
4. **Streaming**: HTTP `Range` with **16-byte-aligned** CTR counter for seeks.

**Trade-off (from plan):** CTR prioritizes **seekable confidentiality** over **built-in integrity**; tamper detection would need AEAD or an extra MAC layer.

---

## 6. Key decisions (preserved)

1. **Full rewrite** — small legacy surface; stack change was total.  
2. **Express** — familiarity and ecosystem over micro-optimizations.  
3. **Raw `pg`** — few tables; SQL migrations stay explicit.  
4. **AES-256-CTR** — fits range-based media streaming; GCM left as a possible future hardening.  
5. **JWT** — stateless API, single user.  
6. **Transcoding** — **ffmpeg** subprocesses rather than `fluent-ffmpeg` in the shipped code (profiles centralized in `transcoding.ts`).

Decision **“video only first”** from the early plan was **superseded** by Phase 7 and the audio playlist work.

---

## 7. Where things live now

| Topic | Location |
|-------|----------|
| Runbook / features / config table | [README.md](../README.md) |
| Env variables (full list) | [.env.example](../.env.example) |
| Compose, Redis, temp volume | [docker.md](docker.md) |
| E2E | [e2e.md](e2e.md) |
| AWS S3 / IAM | [infra.md](infra.md) |
| API types | `backend/src/openapi.yaml` → `frontend` `npm run api:generate` |

This file is **historical**; it is not a backlog. New work should be tracked in issues or a separate roadmap if you introduce one.
