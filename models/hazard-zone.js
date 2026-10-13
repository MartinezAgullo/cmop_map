// models/hazard-zone.js
//
// Hazard zones: one row per hazard event (a flood, a fire), its area a MultiPolygon
// whose parts may lie apart. Every function takes `db`, a pg Pool or a client inside
// a transaction (the scenario loader), and returns rows in the API shape:
//
//   { id, name, hazard_type, description, active,
//     geometry:   GeoJSON MultiPolygon, [lng, lat],
//     icon_point: { lat, lng }   — on the zone, where the map draws the event icon
//     area_m2, created_at, updated_at }
//
// Input is validated by lib/hazard-zone-input.js first; PostGIS then repairs a
// self-intersecting polygon, fuses overlapping parts and keeps only polygons.
// ---------------------------------------------------------------------------

const SELECT = `
  SELECT
    hz.id, hz.name, hz.hazard_type, hz.description, hz.active,
    ST_AsGeoJSON(hz.geom, 7)::jsonb               AS geometry,
    json_build_object('lat', ST_Y(ST_PointOnSurface(hz.geom)),
                      'lng', ST_X(ST_PointOnSurface(hz.geom)))  AS icon_point,
    round(ST_Area(hz.geom::geography)::numeric, 1)::float8      AS area_m2,
    hz.created_at, hz.updated_at
  FROM hazard_zones hz
`;

// GeoJSON parameter → a valid, non-empty MultiPolygon in EPSG:4326. Each part is
// repaired on its own and then the parts are unioned: an area added to a zone fuses
// with the parts it overlaps or touches and stays apart from the rest. (ST_MakeValid on
// the whole MultiPolygon would instead cut the overlap out, as if it were a hole.)
const GEOM_FROM = (param) => `ST_Multi(ST_CollectionExtract(ST_Union(ARRAY(
    SELECT ST_MakeValid(part.geom)
    FROM ST_Dump(ST_SetSRID(ST_GeomFromGeoJSON(${param}), 4326)) AS part
  )), 3))`;

/** @param {{ type?: string, active?: boolean }} filters */
async function list(db, { type, active } = {}) {
  const where = [];
  const params = [];
  if (type)              { params.push(type);   where.push(`hz.hazard_type = $${params.length}::hazard_type_enum`); }
  if (active !== undefined) { params.push(active); where.push(`hz.active = $${params.length}`); }
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY hz.name`;
  const { rows } = await db.query(sql, params);
  return rows;
}

async function getById(db, id) {
  const { rows } = await db.query(`${SELECT} WHERE hz.id = $1`, [id]);
  return rows[0] ?? null;
}

async function create(db, data) {
  const { rows } = await db.query(
    `INSERT INTO hazard_zones (name, hazard_type, description, active, geom)
     VALUES ($1, $2::hazard_type_enum, $3, $4, ${GEOM_FROM('$5')})
     RETURNING id`,
    [data.name, data.hazard_type, data.description ?? null, data.active ?? true,
     JSON.stringify(data.geometry)]
  );
  return getById(db, rows[0].id);
}

/** Partial update: only the fields present in `data` change; geometry is replaced whole. */
async function update(db, id, data) {
  const { rows } = await db.query(
    `UPDATE hazard_zones SET
       name        = COALESCE($1, name),
       hazard_type = COALESCE($2::hazard_type_enum, hazard_type),
       description = CASE WHEN $3::boolean THEN $4 ELSE description END,
       active      = COALESCE($5, active),
       geom        = CASE WHEN $6::text IS NULL THEN geom ELSE ${GEOM_FROM('$6')} END
     WHERE id = $7
     RETURNING id`,
    [data.name ?? null, data.hazard_type ?? null,
     data.description !== undefined, data.description ?? null,
     data.active ?? null,
     data.geometry ? JSON.stringify(data.geometry) : null,
     id]
  );
  return rows[0] ? getById(db, id) : null;
}

/** @returns {Promise<boolean>} whether a row was deleted */
async function remove(db, id) {
  const { rowCount } = await db.query('DELETE FROM hazard_zones WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { list, getById, create, update, remove };
