// lib/coordinates.js
//
// Whether a longitude and latitude can be a place on Earth. Pure, no I/O. The one check
// for every write that carries a position: an entity (routes/entities.js) and each
// vertex of a hazard zone (lib/hazard-zone-input.js). Before it, an entity at
// latitude 123, longitude 500 was stored as sent.
// ---------------------------------------------------------------------------

/** The reason a position is not one, or null when it is. */
function coordinateProblem(lng, lat) {
  const [x, y] = [Number(lng), Number(lat)];
  // Number(null) and Number('') are 0, a real place: neither may pass as one.
  const blank = v => v == null || v === '';
  if (blank(lng) || blank(lat) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return 'longitude and latitude must be numbers';
  }
  if (y < -90 || y > 90) return `latitude ${lat} is out of range (-90 to 90)`;
  if (x < -180 || x > 180) return `longitude ${lng} is out of range (-180 to 180)`;
  return null;
}

module.exports = { coordinateProblem };
