-- Feature 0b (spec 0014): optional projects capture in resume extraction.
-- Adds a nullable projects jsonb column to profiles.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS projects jsonb;
