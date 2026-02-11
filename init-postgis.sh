#!/bin/sh
# ==============================================================================
# init-postgis.sh
# Installs PostGIS extension in PostgreSQL (ARM64 compatible)
# ==============================================================================

set -e

# Wait for PostgreSQL to be ready
until pg_isready -U postgres; do
  echo "Waiting for PostgreSQL..."
  sleep 1
done

echo "Installing PostGIS extension..."

# Install PostGIS packages
apk add --no-cache \
    postgis \
    postgis-contrib

# Create PostGIS extension in the database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_topology;
    SELECT PostGIS_version();
EOSQL

echo "PostGIS extension installed successfully!"
