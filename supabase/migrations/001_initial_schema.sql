-- ==============================================================================
-- Rahami — رهامي: Initial Supabase PostgreSQL Schema
-- Migration: 001_initial_schema.sql
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    last_login TIMESTAMPTZ
);

-- 2. Platform Authorized Users Table (Exactly two accounts by default)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    total_downloads INT DEFAULT 0,
    successful_downloads INT DEFAULT 0,
    failed_downloads INT DEFAULT 0,
    last_activity TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Downloads Table
CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT DEFAULT 'Direct',
    title TEXT DEFAULT '',
    filename TEXT DEFAULT '',
    format TEXT DEFAULT '',
    file_size BIGINT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, analyzing, downloading, processing, completed, failed, cancelled
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    completed_at TIMESTAMPTZ,
    duration_seconds REAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Download Errors Center Table
CREATE TABLE IF NOT EXISTS download_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    source TEXT DEFAULT 'unknown',
    user_id TEXT DEFAULT 'system',
    status TEXT DEFAULT 'active', -- active, resolved, ignored
    occurrences INT DEFAULT 1,
    last_occurred_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Administrative Audit Logs (System Events)
CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL, -- LOGIN, LOGOUT, USER_EDIT, PASSWORD_CHANGE, SETTING_CHANGE, DOWNLOAD_CANCEL, MAINTENANCE_TOGGLE
    target TEXT DEFAULT '',
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Site Settings Table (Single row singleton)
CREATE TABLE IF NOT EXISTS site_settings (
    id INT PRIMARY KEY DEFAULT 1,
    site_name TEXT DEFAULT 'Rahami — رهامي',
    site_description TEXT DEFAULT 'منصة التحميل الشخصية الفاخرة',
    logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT '',
    primary_language TEXT DEFAULT 'ar',
    default_theme TEXT DEFAULT 'dark',
    maintenance_mode BOOLEAN DEFAULT FALSE,
    maintenance_message TEXT DEFAULT 'الموقع حاليًا تحت الصيانة الدورية لتحديث الأنظمة، سنعود قريبًا.',
    max_file_size_mb INT DEFAULT 200,
    download_timeout INT DEFAULT 900,
    max_concurrent_downloads INT DEFAULT 2,
    max_retries INT DEFAULT 2,
    retention_hours INT DEFAULT 24,
    auto_cleanup_enabled BOOLEAN DEFAULT TRUE,
    auto_healing_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Insert default site settings if not present
INSERT INTO site_settings (id, site_name)
VALUES (1, 'Rahami — رهامي')
ON CONFLICT (id) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_download_errors_status ON download_errors(status);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_action ON system_events(action);
