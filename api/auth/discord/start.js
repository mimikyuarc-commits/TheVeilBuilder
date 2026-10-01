const crypto = require('node:crypto');
const { allowMethods, sendJson } = require('../../_lib/http');
const { STATE_COOKIE, setCookie } = require('../../_lib/session');

module.exports = function startDiscordAuth(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI, DISCORD_CLIENT_SECRET, SESSION_SECRET } = process.env;
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI
      || !SESSION_SECRET || SESSION_SECRET.length < 32) {
    sendJson(res, 503, { error: 'Discord sign-in is not configured for this deployment.' });
    return;
  }

  const state = crypto.randomBytes(32).toString('base64url');
  setCookie(res, STATE_COOKIE, state, 600);
  const authorizeUrl = new URL('https://discord.com/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', DISCORD_REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'identify');
  authorizeUrl.searchParams.set('state', state);
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', authorizeUrl.toString());
  res.end();
};
