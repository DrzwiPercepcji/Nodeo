-- Multiple video thumbnails per row; optional per-frame AES-CTR IV when collection is encrypted.
ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnails JSONB;

UPDATE media
SET thumbnails = jsonb_build_array(
  jsonb_build_object('s3_key', thumb_s3_key, 'encryption_iv', NULL)
)
WHERE thumb_s3_key IS NOT NULL AND btrim(thumb_s3_key) <> '';

ALTER TABLE media DROP COLUMN IF EXISTS thumb_s3_key;
