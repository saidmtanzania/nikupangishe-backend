-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for GPS-based queries (optional but recommended)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create database if not exists (handled by Docker env vars)