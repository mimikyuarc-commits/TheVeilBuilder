const { readSession } = require('./session');
const { sendJson } = require('./http');

function isConfiguredAdmin(discordId) {
  const adminIds = String(process.env.ADMIN_DISCORD_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
  return adminIds.includes(discordId);
}

function requireAdmin(req, res) {
  const session = readSession(req);
  if (!session) {
    sendJson(res, 401, { error: 'Sign in with an approved Discord admin account.' });
    return null;
  }
  if (!process.env.ADMIN_DISCORD_IDS) {
    sendJson(res, 503, { error: 'Admin access is not configured for this deployment.' });
    return null;
  }
  if (!isConfiguredAdmin(session.discordId)) {
    sendJson(res, 403, { error: 'This Discord account is not approved for site administration.' });
    return null;
  }
  return session;
}

module.exports = { isConfiguredAdmin, requireAdmin };
