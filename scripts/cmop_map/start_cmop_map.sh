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
    exit 0
}
trap cleanup SIGINT SIGTERM

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

# Wait for PostgreSQL to be ready
echo -n "⏳ Waiting for PostgreSQL"
until docker exec cmop_map_postgis pg_isready -U postgres >/dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e "\n✅ PostgreSQL ready"

# ---------------------------------------------------------------------------
# 4. Schema init (idempotent — drops & recreates)
# ---------------------------------------------------------------------------
echo ""
echo -n "⚙️  Initialize DB schema? (y/N): "
read -r INIT_REPLY
if [[ "$INIT_REPLY" =~ ^[Yy]$ ]]; then
    echo "🔄 Dropping old schema..."
    docker exec -it cmop_map_postgis psql -U postgres -d cmop_db -c "DROP TYPE IF EXISTS categoria_militar CASCADE;" >/dev/null 2>&1
    echo "🔨 Creating new schema..."
    node scripts/init-db.js
fi

# ---------------------------------------------------------------------------
# 5. Load scenario
# ---------------------------------------------------------------------------
echo ""
echo "📋 Available scenarios:"
node scripts/load-scenario.js --list 2>/dev/null | grep -E "^\s+-" | nl -w2 -s'. '
echo ""
echo -n "🔦 Load a scenario? (name or number, Enter to skip): "
read -r SCENARIO_INPUT

if [[ -n "$SCENARIO_INPUT" ]]; then
    # Check if input is a number (scenario selection by index)
    if [[ "$SCENARIO_INPUT" =~ ^[0-9]+$ ]]; then
        SCENARIO=$(node scripts/load-scenario.js --list 2>/dev/null | grep -E "^\s+-" | sed -n "${SCENARIO_INPUT}p" | awk '{print $2}')
    else
        SCENARIO="$SCENARIO_INPUT"
    fi
    
    if [[ -n "$SCENARIO" ]]; then
        echo "📥 Loading scenario: $SCENARIO"
        node scripts/load-scenario.js "$SCENARIO"
    else
        echo "⚠️  Invalid scenario selection"
    fi
fi

# ---------------------------------------------------------------------------
# 6. Dev server
# ---------------------------------------------------------------------------
echo ""
echo "🌐 Starting server → http://localhost:3000"
echo "💡 Press Ctrl+C to stop everything."
echo ""

# Auto-open browser after 2 seconds (background process)
(sleep 2 && open http://localhost:3000 2>/dev/null) &

npm run dev
