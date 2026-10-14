// lib/capacity-limits.js
//
// How many people a vehicle may be declared to carry (the `capacity` column), and the
// checks on the capacity and occupancy of shelters and medical facilities. One source
// of truth for the API (routes/entities.js), the scenario loader and the New Entity
// form, which asks GET /api/entities/meta/capacity-limit.
//
// The limits are ceilings for realistic vehicles, agreed on 2026-10-14. They stop a
// typo (220 instead of 22) from reaching the planner, which would then put a whole
// neighbourhood in one vehicle. The first rule that matches wins, so the order matters.
// ---------------------------------------------------------------------------

const CAPACITY_LIMITS = [
  // MEDEVAC units, ground ambulances and helicopters alike: the QUBO assignment
  // optimiser (medevac_qubo) models a platform carrying one or two litters, so a
  // larger value could not be planned.
  { categoria: 'medevac_unit', max: 2,  vehicle: 'ambulance or helicopter (the QUBO optimiser plans 1 or 2)' },
  // An armoured personnel carrier (BMR, Pizarro, VAMTAC) seats about ten.
  { categoria: 'armoured',     max: 10, vehicle: 'armoured vehicle' },
  // An unmanned ground vehicle carries one or two litters.
  { categoria: 'ugv',          max: 2,  vehicle: 'unmanned ground vehicle' },
  // A helicopter: a Bell 412, the largest utility helicopter in civil emergency
  // fleets, carries up to 15 people.
  { categoria: 'helicopter',   max: 15, vehicle: 'helicopter' },
  { mobility: 'air',           max: 15, vehicle: 'helicopter' },
  // A large rescue boat or rigid-hull inflatable takes about twelve.
  { mobility: 'sea',           max: 12, vehicle: 'boat' },
  // Any other ground vehicle: a transport minibus, the largest that evacuates
  // people, carries 22.
  {                            max: 22, vehicle: 'ground vehicle' },
];

// Categories that receive people and have a capacity of places, with an occupancy.
const FACILITY_CATEGORIES = ['shelter', 'medical_facility'];

// Places and people already there for a medical facility of each NATO role, used by the
// scenarios and the MASCAL generator: a higher role is a larger facility. Generous on
// purpose (agreed 2026-10-14): no scenario runs out of places until a full facility is
// tested on purpose.
const FACILITY_SIZE_BY_ROLE = {
  medical_role_1:                 { max_capacity: 50,  initial_occupancy: 5 },
  medical_role_2:                 { max_capacity: 100, initial_occupancy: 15 },
  medical_role_2basic:            { max_capacity: 100, initial_occupancy: 15 },
  medical_role_2enhanced:         { max_capacity: 150, initial_occupancy: 20 },
  medical_role_3:                 { max_capacity: 300, initial_occupancy: 50 },
  medical_role_4:                 { max_capacity: 600, initial_occupancy: 150 },
  medical_facility_multinational: { max_capacity: 300, initial_occupancy: 50 },
};

/** The rule that applies to a vehicle of this category and mobility. */
function capacityLimit({ categoria, mobility } = {}) {
  return CAPACITY_LIMITS.find(rule =>
    (rule.categoria === undefined || rule.categoria === categoria) &&
    (rule.mobility  === undefined || rule.mobility  === mobility));
}

const isWholeNumber = v => Number.isInteger(Number(v)) && String(v).trim() !== '';

/**
 * What is wrong with the capacities an entity is given, or null. Returns
 * { field, message, rejected? }: `rejected` marks a capacity over the vehicle's limit,
 * which the caller logs as a warning. Fields that are absent are not checked.
 */
function capacityProblem(entity) {
  const { capacity, max_capacity: maxCapacity, initial_occupancy: initial } = entity;

  if (capacity != null) {
    if (!isWholeNumber(capacity) || Number(capacity) < 1) {
      return { field: 'capacity', message: `capacity must be a whole number of 1 or more, not ${capacity}` };
    }
    const rule = capacityLimit(entity);
    if (Number(capacity) > rule.max) {
      return {
        field: 'capacity',
        rejected: true,
        message: `Capacity not accepted. Number ${capacity} larger than maximum accepted ${rule.max} for a ${entity.categoria} ${rule.vehicle}`,
      };
    }
  }

  if (maxCapacity != null && (!isWholeNumber(maxCapacity) || Number(maxCapacity) < 1)) {
    return { field: 'max_capacity', message: `max_capacity must be a whole number of 1 or more, not ${maxCapacity}` };
  }
  if (initial != null) {
    if (!isWholeNumber(initial) || Number(initial) < 0) {
      return { field: 'initial_occupancy', message: `initial_occupancy must be a whole number of 0 or more, not ${initial}` };
    }
    if (maxCapacity != null && Number(initial) > Number(maxCapacity)) {
      return { field: 'initial_occupancy', message: `initial_occupancy ${initial} is above max_capacity ${maxCapacity}` };
    }
  }
  return null;
}

module.exports = { CAPACITY_LIMITS, FACILITY_CATEGORIES, FACILITY_SIZE_BY_ROLE, capacityLimit, capacityProblem };
