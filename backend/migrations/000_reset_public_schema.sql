-- ============================================================================
-- DESTRUCTIVE: Reset the ArisanKita application schema for a fresh demo setup.
-- This deletes every object and all data in the `public` schema.
-- It does not delete Supabase schemas such as `auth` or `storage`.
-- Run only before 001_schema_v2.sql, never as an application migration.
-- ============================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Keep standard Supabase API roles able to access objects created in public.
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
