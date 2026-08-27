-- ==============================================================================
-- Rahami — رهامي: Row Level Security (RLS) Policies
-- Migration: 002_rls_policies.sql
-- ==============================================================================

-- Enable Row Level Security on all tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- 1. admin_users: Strict private access - No public or anon access permitted
CREATE POLICY "Deny all public access to admin_users"
    ON admin_users
    FOR ALL
    TO public, anon
    USING (false);

-- 2. users: Deny public direct access. Backend mediates all operations with service role.
CREATE POLICY "Deny direct public access to users table"
    ON users
    FOR ALL
    TO public, anon
    USING (false);

-- 3. downloads: Deny direct public access. Handled via backend endpoints.
CREATE POLICY "Deny direct public access to downloads"
    ON downloads
    FOR ALL
    TO public, anon
    USING (false);

-- 4. download_errors: Admin internal only. Deny public access.
CREATE POLICY "Deny direct public access to download_errors"
    ON download_errors
    FOR ALL
    TO public, anon
    USING (false);

-- 5. system_events: Audit logs are immutable and hidden from public.
CREATE POLICY "Deny direct public access to system_events"
    ON system_events
    FOR ALL
    TO public, anon
    USING (false);

-- 6. site_settings: Allow read access to public/anon (for maintenance mode check and branding)
CREATE POLICY "Allow public read-only access to site_settings"
    ON site_settings
    FOR SELECT
    TO public, anon
    USING (true);

CREATE POLICY "Deny public modifications to site_settings"
    ON site_settings
    FOR INSERT
    TO public, anon
    WITH CHECK (false);

CREATE POLICY "Deny public updates to site_settings"
    ON site_settings
    FOR UPDATE
    TO public, anon
    USING (false);
