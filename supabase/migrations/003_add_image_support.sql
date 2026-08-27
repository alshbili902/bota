-- ==============================================================================
-- Rahami — رهامي: Migration 003 — Add Image and Carousel Support
-- Adds media_type, width, height, image_format to downloads table
-- ==============================================================================

ALTER TABLE downloads ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'video';
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS width INT;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS height INT;
ALTER TABLE downloads ADD COLUMN IF NOT EXISTS image_format TEXT;

CREATE INDEX IF NOT EXISTS idx_downloads_media_type ON downloads(media_type);
