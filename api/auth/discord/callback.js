const crypto = require('node:crypto');
const { getFirestore } = require('../../_lib/db');
const { allowMethods } = require('../../_lib/http');
const {
  STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  clearCookie,
  getCookie,
  setCookie,
  signSession,
} = require('../../_lib/session');

const PRODUCTION_ORIGIN = 'https://www.theveilbuilder.com';
const PRODUCTION_REDIRECT_URI = `${PRODUCTION_ORIGIN}/api/auth/discord/callback`;

function redirectWithError(res, code) {
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  const origin = process.env.VERCEL_ENV === 'production' ? PRODUCTION_ORIGIN : '';
  res.setHeader('Location', `${origin}/?authError=${encodeURIComponent(code)}`);
  res.end();
}

module.exports = async function finishDiscordAuth(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  if (process.env.VERCEL_ENV === 'production'
      && String(req.headers.host || '').toLowerCase() !== 'www.theveilbuilder.com') {
    const query = new URLSearchParams(req.query).toString();
    res.statusCode = 302;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', `${PRODUCTION_ORIGIN}/api/auth/discord/callback${query ? `?${query}` : ''}`);
    res.end();
    return;
  }
  const stateCookie = getCookie(req, STATE_COOKIE);
  const stateQuery = typeof req.query.state === 'string' ? req.query.state : '';
  clearCookie(res, STATE_COOKIE);
  if (!stateCookie || !stateQuery
      || Buffer.byteLength(stateCookie) !== Buffer.byteLength(stateQuery)
      || !crypto.timingSafeEqual(Buffer.from(stateCookie), Buffer.from(stateQuery))) {
    redirectWithError(res, 'state_mismatch');
    return;
  }
  if (typeof req.query.error === 'string') {
    redirectWithError(res, 'discord_denied');
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = process.env;
  const redirectUri = process.env.VERCEL_ENV === 'production'
    ? PRODUCTION_REDIRECT_URI
    : process.env.DISCORD_REDIRECT_URI;
  if (!code || !DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !redirectUri) {
    redirectWithError(res, 'auth_not_configured');
    return;
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) throw new Error(`Discord token exchange failed (${tokenResponse.status}).`);
    const token = await tokenResponse.json();
    if (typeof token.access_token !== 'string') throw new Error('Discord returned no access token.');

    const profileResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) throw new Error(`Discord profile request failed (${profileResponse.status}).`);
    const profile = await profileResponse.json();
    if (typeof profile.id !== 'string' || typeof profile.username !== 'string') {
      throw new Error('Discord returned an invalid profile.');
    }

    const avatarUrl = typeof profile.avatar === 'string'
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith('a_') ? 'gif' : 'png'}?size=96`
      : null;
    const displayName = typeof profile.global_name === 'string' && profile.global_name
      ? profile.global_name.slice(0, 100)
      : profile.username.slice(0, 100);

    const userRef = getFirestore().collection('veilUsers').doc(profile.id);
    const previousUser = await userRef.get();
    await userRef.set({
      username: profile.username.slice(0, 100),
      displayName,
      avatarUrl,
      ...(previousUser.exists ? {} : { createdAt: new Date() }),
      updatedAt: new Date(),
    }, { merge: true });

    setCookie(res, SESSION_COOKIE, signSession(profile.id), SESSION_MAX_AGE);
    res.statusCode = 302;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', process.env.VERCEL_ENV === 'production' ? `${PRODUCTION_ORIGIN}/` : '/');
    res.end();
  } catch (error) {
    console.error('[discord-auth] Sign-in failed:', error);
    redirectWithError(res, 'auth_failed');
  }
};
