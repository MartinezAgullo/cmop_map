#!/bin/bash

# ==============================================================================
# start_cmop_map.sh
# Orchestrates the local CMOP Map environment.
#   Docker daemon · PostgreSQL · optional schema init · scenario loader · dev server
# ==============================================================================

REPO_PATH="/Users/pablo/Desktop/Scripts/cmop_map"

# ---------------------------------------------------------------------------
# Cleanup on Ctrl+C
# ---------------------------------------------------------------------------
cleanup() {
    echo -e "\n\n🛑 Stopping services..."
    docker compose down
    echo "✅ Cleaned up. Goodbye!"
    exit
}
trap cleanup SIGINT

# ---------------------------------------------------------------------------
# 1. Navigate to repo
# ---------------------------------------------------------------------------
if ! cd "$REPO_PATH" 2>/dev/null; then
    echo "❌ Error: cannot reach $REPO_PATH"
    exit 1
fi

# ---------------------------------------------------------------------------
# 2. Docker Desktop
# ---------------------------------------------------------------------------
if ! docker info >/dev/null 2>&1; then
    echo "🚀 Starting Docker Desktop..."
    open -a Docker

    echo -n "⏳ Waiting for daemon"
    while ! docker info >/dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo -e "\n✅ Docker ready"
fi

# ---------------------------------------------------------------------------
# 3. PostgreSQL container
# ---------------------------------------------------------------------------
echo "📦 Starting PostgreSQL..."
docker compose up -d

# ---------------------------------------------------------------------------
# 4. Schema init (idempotent — drops & recreates)
# ---------------------------------------------------------------------------
read -p "⚙️  Initialize DB schema? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    node scripts/init-db.js
fi

# ---------------------------------------------------------------------------
# 5. Load scenario
# ---------------------------------------------------------------------------
echo ""
echo "Available scenarios:"
node scripts/load-scenario.js --list 2>/dev/null | grep -E "^\s+-"
echo ""
read -p "📦 Load a scenario? (scenario name or Enter to skip): " -r SCENARIO
if [[ -n "$SCENARIO" ]]; then
    node scripts/load-scenario.js "$SCENARIO"
fi

# ---------------------------------------------------------------------------
# 6. Dev server
# ---------------------------------------------------------------------------
echo ""
echo "🌐 Starting server → http://localhost:3000"
echo "💡 Press Ctrl+C to stop everything."
echo ""
npm run dev
