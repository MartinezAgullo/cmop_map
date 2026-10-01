// config/services.js
//
// Base URLs of the services this server talks to.  The single source for
// routes, proxies and the startup dependency check.
// ---------------------------------------------------------------------------

require('dotenv').config();

const trimSlash = url => url.replace(/\/$/, '');

module.exports = {
  planner:  trimSlash(process.env.MEDEVAC_PLANNER_URL || 'http://localhost:8400'),
  pfcAgent: trimSlash(process.env.PFC_AGENT_BASE      || 'http://localhost:8600'),
  vision:   trimSlash(process.env.VISION_AGENT_URL    || 'http://localhost:8500'),
};
