const crypto = require('node:crypto');
const { allowMethods, sendJson } = require('../../_lib/http');
const { STATE_COOKIE, setCookie } = require('../../_lib/session');

const PRODUCTION_ORIGIN = 'https://www.theveilbuilder.com';
const PRODUCTION_REDIRECT_URI = `${PRODUCTION_ORIGIN}/api/auth/discord/callback`;

module.exports = function startDiscordAuth(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, SESSION_SECRET } = process.env;
  const redirectUri = process.env.VERCEL_ENV === 'production'
    ? PRODUCTION_REDIRECT_URI
    : process.env.DISCORD_REDIRECT_URI;
  if (process.env.VERCEL_ENV === 'production'
      && String(req.headers.host || '').toLowerCase() !== 'www.theveilbuilder.com') {
    res.statusCode = 302;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', `${PRODUCTION_ORIGIN}/api/auth/discord/start`);
    res.end();
    return;
  }
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !redirectUri
      || !SESSION_SECRET || SESSION_SECRET.length < 32) {
    sendJson(res, 503, { error: 'Discord sign-in is not configured for this deployment.' });
    return;
  }

  const state = crypto.randomBytes(32).toString('base64url');
  setCookie(res, STATE_COOKIE, state, 600);
  const authorizeUrl = new URL('https://discord.com/oauth2/authorize');
  authorizeUrl.searchParams.set('client_id', DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'identify');
  authorizeUrl.searchParams.set('state', state);
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', authorizeUrl.toString());
  res.end();
};
