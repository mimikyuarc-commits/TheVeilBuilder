const { allowMethods, requireSameOrigin, sendJson } = require('../_lib/http');
const { SESSION_COOKIE, clearCookie } = require('../_lib/session');

module.exports = function logout(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!requireSameOrigin(req, res)) return;
  clearCookie(res, SESSION_COOKIE);
  sendJson(res, 200, { ok: true });
};
