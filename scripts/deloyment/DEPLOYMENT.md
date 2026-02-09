# CMOP Map - Deployment Guide

Quick deployment guide for running CMOP Map locally using Docker.

---

## Prerequisites

- **Docker Desktop** installed and running
  - Download: https://www.docker.com/products/docker-desktop
- **Git** (to clone the repository)

---

## Quick Start (One Command)

```bash
git clone https://github.com/MartinezAgullo/cmop_map/
cd cmop_map
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Build Docker images
2. Start PostgreSQL + PostGIS
3. Start Node.js backend
4. Initialize database schema
5. Load default scenario
6. Open browser at `http://localhost:3000`

---

## Manual Deployment (Alternative)

If you prefer step-by-step control:

```bash
# 1. Clone repository
git clone <repository-url>
cd cmop_map

# 2. Start services
docker compose up -d --build

# 3. Wait for PostgreSQL (check logs)
docker compose logs -f postgis

# 4. Initialize database (in another terminal)
docker exec cmop_map_backend node scripts/init-db.js

# 5. Load scenario
docker exec cmop_map_backend node scripts/load-scenario.js paris_sud_medevac

# 6. Open browser
open http://localhost:3000
```

---

## Available Scenarios

List scenarios:
```bash
docker exec cmop_map_backend node scripts/load-scenario.js --list
```

Load a specific scenario:
```bash
docker exec cmop_map_backend node scripts/load-scenario.js <scenario_name>
```

Available scenarios:
- `valencia_urban` - Urban combat baseline
- `valencia_medevac` - Valencia + MEDEVAC operations
- `mariupol_siege` - RUS vs UKR urban siege
- `paris_sud_medevac` - Multinational exercise (default)

---

## Common Commands

### View logs
```bash
docker compose logs -f backend     # Backend logs
docker compose logs -f postgis     # Database logs
docker compose logs -f             # All logs
```

### Restart services
```bash
docker compose restart backend     # Restart backend only
docker compose restart             # Restart all services
```

### Stop services
```bash
docker compose down                # Stop and remove containers
docker compose down -v             # Stop and remove containers + volumes (data loss!)
```

### Access database directly
```bash
docker exec -it cmop_map_postgis psql -U postgres -d cmop_db
```

### Execute commands in backend
```bash
docker exec cmop_map_backend <command>
```

---

## Ports

- **3000** - CMOP Map web interface (http://localhost:3000)
- **5432** - PostgreSQL database (localhost:5432)

---

## Data Persistence

Database data is stored in a Docker volume (`cmop_postgis_data`). This persists between container restarts.

To completely reset the database:
```bash
docker compose down -v          # Remove volumes
docker compose up -d --build    # Recreate everything
./deploy.sh                     # Or re-run deployment
```

---

## Updating

Pull latest changes and rebuild:
```bash
git pull
docker compose up -d --build
```

---

## Troubleshooting

### "Port 3000 already in use"

Another application is using port 3000. Either:
1. Stop the other application
2. Or edit `docker-compose.yml` to use a different port:
   ```yaml
   ports:
     - "3001:3000"  # Use 3001 instead
   ```

### "Port 5432 already in use"

PostgreSQL is already running on your machine. Either:
1. Stop your local PostgreSQL
2. Or edit `docker-compose.yml` to use a different port:
   ```yaml
   ports:
     - "5433:5432"  # Use 5433 instead
   ```

### "Database connection failed"

Wait a bit longer for PostgreSQL to start:
```bash
docker compose logs -f postgis
```

Wait for: `database system is ready to accept connections`

### "Cannot connect to Docker daemon"

Start Docker Desktop.

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Browser (localhost:3000)        │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Backend Container (cmop_map_backend)   │
│  - Node.js + Express                    │
│  - REST API                             │
│  - Static files (Leaflet frontend)      │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  PostGIS Container (cmop_map_postgis)   │
│  - PostgreSQL 16                        │
│  - PostGIS 3.4                          │
│  - Geospatial data                      │
└─────────────────────────────────────────┘
```

---

## For Developers

### Local development (without Docker)

If you want to develop without Docker:

```bash
# 1. Start only PostgreSQL in Docker
docker compose up -d postgis

# 2. Install dependencies
npm install

# 3. Create .env
cp .env.example .env
# Edit DB_HOST=127.0.0.1 (not 'postgis')

# 4. Init schema
node scripts/init-db.js

# 5. Load scenario
node scripts/load-scenario.js paris_sud_medevac

# 6. Start dev server
npm run dev
```

### Rebuild backend image

```bash
docker compose build backend
docker compose up -d backend
```

---

## Support

For issues or questions:
1. Check logs: `docker compose logs -f`
2. Verify all containers are running: `docker compose ps`
3. Check the main README.md for API documentation

---

## License

GPL 3.0
