// models/entity.js
//
// Single source of truth for puntos_interes + medical_details.
//
// Design rules:
//   - baseSelect() always LEFT JOINs medical_details.  Every method
//     that returns entity rows goes through it → medical is always
//     present (as an object) or null.  No extra queries needed.
//   - create() / update() accept an optional `medical` key in the
//     payload.  When present they open a transaction, so entity +
//     medical record are written atomically.
//   - The public shape of `medical` in responses mirrors the DB columns
//     exactly, plus `destination_facility` as a nested { id, nombre }
//     resolved via a sub-select in baseSelect.
// ---------------------------------------------------------------------------

const pool = require('../config/database');

class Entity {
  // ---------------------------------------------------------------
  // Shared SELECT  (used by every read method)
  // ---------------------------------------------------------------
  static baseSelect() {
    return `
      SELECT
        pi.id,
        pi.nombre,
        pi.descripcion,
        pi.categoria,
        pi.country,
        pi.alliance,
        pi.elemento_identificado,
        pi.activo,
        pi.tipo_elemento,
        pi.prioridad,
        pi.observaciones,
        pi.altitud,
        ST_X(pi.geom) AS longitud,
        ST_Y(pi.geom) AS latitud,
        pi.created_at,
        pi.updated_at,

        -- medical_details as a single JSONB object (null when no record)
        CASE WHEN md.entity_id IS NOT NULL THEN
          jsonb_build_object(
            'triage_color',              md.triage_color,
            'injury_mechanism',          md.injury_mechanism,
            'primary_injury',            md.primary_injury,
            'vital_signs',               md.vital_signs,
            'prehospital_treatment',     md.prehospital_treatment,
            'evac_priority',             md.evac_priority,
            'evac_stage',                md.evac_stage,
            'destination_facility',      CASE WHEN df.id IS NOT NULL THEN
                                           jsonb_build_object('id', df.id, 'nombre', df.nombre)
                                         ELSE NULL END,
            'nine_line_data',            md.nine_line_data,
            'created_at',                md.created_at,
            'updated_at',                md.updated_at
          )
        ELSE NULL END AS medical
      FROM puntos_interes pi
      LEFT JOIN medical_details md ON md.entity_id = pi.id
      LEFT JOIN puntos_interes df ON df.id = md.destination_facility_id
    `;
  }

  // ---------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------

  /** All entities, ordered by nombre */
  static async getAll() {
    const { rows } = await pool.query(`${this.baseSelect()} ORDER BY pi.nombre`);
    return rows;
  }

  /** Single entity by PK */
  static async getById(id) {
    const { rows } = await pool.query(
      `${this.baseSelect()} WHERE pi.id = $1`, [id]
    );
    return rows[0] ?? null;
  }

  /** Filter by categoria enum value */
  static async getByCategoria(categoria) {
    const { rows } = await pool.query(
      `${this.baseSelect()} WHERE pi.categoria = $1 ORDER BY pi.nombre`,
      [categoria]
    );
    return rows;
  }

  /**
   * Spatial radius query.
   * Returns same shape as other reads (medical included) plus `distancia` (m).
   */
  static async getNearby(longitud, latitud, radio = 50000) {
    const { rows } = await pool.query(
      `${this.baseSelect()},
       ST_Distance(
         pi.geom::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       ) AS distancia
       WHERE ST_DWithin(
         pi.geom::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       )
       ORDER BY distancia`,
      [longitud, latitud, radio]
    );
    return rows;
  }

  /** All values of the categoria_militar enum (includes new medical categories) */
  static async getCategorias() {
    const { rows } = await pool.query(
      `SELECT unnest(enum_range(NULL::categoria_militar)) AS categoria`
    );
    return rows.map(r => r.categoria);
  }

  // ---------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------

  /**
   * Insert an entity.  If `data.medical` is present, also inserts
   * the medical_details row in the same transaction.
   *
   * data.medical (optional) shape:
   *   {
   *     triage_color, injury_mechanism, primary_injury,
   *     vital_signs,  prehospital_treatment,
   *     evac_priority, evac_stage,
   *     destination_facility_id,   ← raw FK (integer)
   *     nine_line_data             ← object, stored as JSONB
   *   }
   */
  static async create(data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const entity = await this._insertEntity(client, data);

      if (data.medical) {
        await this._upsertMedical(client, entity.id, data.medical);
      }

      await client.query('COMMIT');

      // Return full shape (with medical JOIN)
      return this.getById(entity.id);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------

  /**
   * Partial update.  Only provided keys are written (COALESCE pattern).
   * If `data.medical` is present, upserts the medical_details row.
   */
  static async update(id, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const entity = await this._updateEntity(client, id, data);
      if (!entity) {
        await client.query('ROLLBACK');
        return null;
      }

      if (data.medical) {
        await this._upsertMedical(client, id, data.medical);
      }

      await client.query('COMMIT');
      return this.getById(id);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------
  // Batch create  (transaction-wrapped)
  // ---------------------------------------------------------------

  static async createBatch(entities) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results = [];
      for (const data of entities) {
        const entity = await this._insertEntity(client, data);
        if (data.medical) {
          await this._upsertMedical(client, entity.id, data.medical);
        }
        results.push(entity.id);
      }

      await client.query('COMMIT');

      // Fetch full rows (with medical JOIN) in one query
      const placeholders = results.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await pool.query(
        `${this.baseSelect()} WHERE pi.id IN (${placeholders}) ORDER BY pi.nombre`,
        results
      );
      return rows;

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------

  /** Deletes entity (medical_details cascades via FK) */
  static async delete(id) {
    const { rows } = await pool.query(
      `DELETE FROM puntos_interes WHERE id = $1 RETURNING id`, [id]
    );
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------
  // Private helpers  (always receive a client for transaction scope)
  // ---------------------------------------------------------------

  static async _insertEntity(client, data) {
    const { rows } = await client.query(
      `INSERT INTO puntos_interes (
         nombre, descripcion, categoria, country, alliance,
         elemento_identificado, activo, tipo_elemento, prioridad,
         observaciones, altitud, geom
       )
       VALUES (
         $1, $2, $3::categoria_militar, $4, $5::alliance_enum,
         $6, $7, $8, $9, $10, $11,
         ST_SetSRID(ST_MakePoint($12, $13), 4326)
       )
       RETURNING id`,
      [
        data.nombre ?? null,
        data.descripcion ?? null,
        data.categoria ?? 'default',
        data.country ?? null,
        data.alliance ?? 'unknown',
        data.elemento_identificado ?? null,
        data.activo !== undefined ? data.activo : true,
        data.tipo_elemento ?? null,
        data.prioridad ?? 0,
        data.observaciones ?? null,
        data.altitud ?? null,
        data.longitud,
        data.latitud
      ]
    );
    return rows[0];
  }

  static async _updateEntity(client, id, data) {
    const { rows } = await client.query(
      `UPDATE puntos_interes
       SET
         nombre                 = COALESCE($1,  nombre),
         descripcion            = COALESCE($2,  descripcion),
         categoria              = COALESCE($3::categoria_militar, categoria),
         country                = COALESCE($4,  country),
         alliance               = COALESCE($5::alliance_enum, alliance),
         elemento_identificado  = COALESCE($6,  elemento_identificado),
         activo                 = COALESCE($7,  activo),
         tipo_elemento          = COALESCE($8,  tipo_elemento),
         prioridad              = COALESCE($9,  prioridad),
         observaciones          = COALESCE($10, observaciones),
         altitud                = COALESCE($11, altitud),
         geom                   = COALESCE(
                                    ST_SetSRID(ST_MakePoint(
                                      CAST($12 AS DOUBLE PRECISION),
                                      CAST($13 AS DOUBLE PRECISION)
                                    ), 4326),
                                    geom
                                  ),
         updated_at             = CURRENT_TIMESTAMP
       WHERE id = $14
       RETURNING id`,
      [
        data.nombre ?? null,
        data.descripcion ?? null,
        data.categoria ?? null,
        data.country ?? null,
        data.alliance ?? null,
        data.elemento_identificado ?? null,
        data.activo ?? null,
        data.tipo_elemento ?? null,
        data.prioridad ?? null,
        data.observaciones ?? null,
        data.altitud ?? null,
        data.longitud ?? null,
        data.latitud ?? null,
        id
      ]
    );
    return rows[0] ?? null;
  }

  /**
   * INSERT ... ON CONFLICT (entity_id) DO UPDATE
   * Handles both initial creation and subsequent partial updates.
   * Only the keys present in `medical` are written; others stay untouched.
   */
  static async _upsertMedical(client, entityId, medical) {
    await client.query(
      `INSERT INTO medical_details (
         entity_id, triage_color, injury_mechanism, primary_injury,
         vital_signs, prehospital_treatment, evac_priority, evac_stage,
         destination_facility_id, nine_line_data
       )
       VALUES (
         $1,
         $2::triage_color_enum,
         $3, $4,
         $5::jsonb,
         $6,
         $7::evac_priority_enum,
         $8::evac_stage_enum,
         $9,
         $10::jsonb
       )
       ON CONFLICT (entity_id) DO UPDATE SET
         triage_color            = COALESCE(EXCLUDED.triage_color,            medical_details.triage_color),
         injury_mechanism        = COALESCE(EXCLUDED.injury_mechanism,        medical_details.injury_mechanism),
         primary_injury          = COALESCE(EXCLUDED.primary_injury,          medical_details.primary_injury),
         vital_signs             = COALESCE(EXCLUDED.vital_signs,             medical_details.vital_signs),
         prehospital_treatment   = COALESCE(EXCLUDED.prehospital_treatment,   medical_details.prehospital_treatment),
         evac_priority           = COALESCE(EXCLUDED.evac_priority,           medical_details.evac_priority),
         evac_stage              = COALESCE(EXCLUDED.evac_stage,              medical_details.evac_stage),
         destination_facility_id = COALESCE(EXCLUDED.destination_facility_id, medical_details.destination_facility_id),
         nine_line_data          = COALESCE(EXCLUDED.nine_line_data,          medical_details.nine_line_data),
         updated_at              = CURRENT_TIMESTAMP`,
      [
        entityId,
        medical.triage_color ?? null,
        medical.injury_mechanism ?? null,
        medical.primary_injury ?? null,
        medical.vital_signs ? JSON.stringify(medical.vital_signs) : null,
        medical.prehospital_treatment ?? null,
        medical.evac_priority ?? null,
        medical.evac_stage ?? null,
        medical.destination_facility_id ?? null,
        medical.nine_line_data ? JSON.stringify(medical.nine_line_data) : null
      ]
    );
  }
}

module.exports = Entity;
