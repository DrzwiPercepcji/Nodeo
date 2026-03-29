CREATE TABLE IF NOT EXISTS collections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    description   TEXT DEFAULT '',
    is_encrypted  BOOLEAN NOT NULL DEFAULT false,
    encrypted_dek BYTEA,
    dek_salt      BYTEA,
    dek_iv        BYTEA,
    verify_token  BYTEA,
    cover_url     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    title           VARCHAR(300) NOT NULL,
    description     TEXT DEFAULT '',
    media_type      VARCHAR(10) NOT NULL DEFAULT 'video',
    duration_sec    INTEGER,
    file_size_bytes BIGINT,
    s3_key          TEXT NOT NULL,
    encryption_iv   BYTEA,
    profile         VARCHAR(20) NOT NULL DEFAULT '720p',
    mime_type       VARCHAR(50) DEFAULT 'video/mp4',
    thumb_s3_key    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_collection ON media(collection_id);
