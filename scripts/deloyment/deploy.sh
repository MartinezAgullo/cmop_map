#!/bin/bash
# ==============================================================================
# deploy.sh - CMOP Map Deployment Script
# ==============================================================================
# One-command deployment for colleagues.
# Handles: Docker check, build, database init, scenario loading, startup.
# ==============================================================================

set -e  # Exit on error

REPO_PATH="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_PATH"

echo "🗺️  CMOP Map Deployment"
echo "======================="
echo ""

# ---------------------------------------------------------------------------
# 1. Check Docker
# ---------------------------------------------------------------------------
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "   Please start Docker Desktop and try again"
    exit 1
fi
echo "✅ Docker is running"

# ---------------------------------------------------------------------------
# 2. Build & Start Services
# ---------------------------------------------------------------------------
echo ""
echo "🔨 Building and starting services..."
docker compose up -d --build

# ---------------------------------------------------------------------------
# 3. Wait for PostgreSQL
# ---------------------------------------------------------------------------
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec cmop_map_postgis pg_isready -U postgres >/dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo ""
echo "✅ PostgreSQL is ready"

# ---------------------------------------------------------------------------
# 4. Initialize Database Schema
# ---------------------------------------------------------------------------
echo ""
echo "🔨 Initializing database schema..."
docker exec cmop_map_backend node scripts/init-db.js

# ---------------------------------------------------------------------------
# 5. Load Default Scenario
# ---------------------------------------------------------------------------
echo ""
echo "📦 Loading default scenario (paris_sud_medevac)..."
docker exec cmop_map_backend node scripts/load-scenario.js paris_sud_medevac

# ---------------------------------------------------------------------------
# 6. Success
# ---------------------------------------------------------------------------
echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 CMOP Map is now running at:"
echo "   http://localhost:3000"
echo ""
echo "📊 Useful commands:"
echo "   docker compose logs -f backend    # View logs"
echo "   docker compose down               # Stop services"
echo "   docker compose restart backend    # Restart backend"
echo ""
echo "📋 Load a different scenario:"
echo "   docker exec cmop_map_backend node scripts/load-scenario.js <scenario_name>"
echo ""

# Open browser (optional)
if command -v open >/dev/null 2>&1; then
    echo "🌐 Opening browser..."
    sleep 2
    open http://localhost:3000
fi
