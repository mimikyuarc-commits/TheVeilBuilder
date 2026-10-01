const crypto = require('node:crypto');

const SESSION_COOKIE = 'veil_builder_session';
const STATE_COOKIE = 'veil_builder_oauth_state';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function isProduction() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function cookieOptions(maxAge) {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProduction() ? '; Secure' : ''}`;
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(cookie.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function appendSetCookie(res, value) {
  const current = res.getHeader('Set-Cookie');
  const next = current ? (Array.isArray(current) ? [...current, value] : [current, value]) : value;
  res.setHeader('Set-Cookie', next);
}

function setCookie(res, name, value, maxAge) {
  appendSetCookie(res, `${name}=${encodeURIComponent(value)}; ${cookieOptions(maxAge)}`);
}

function clearCookie(res, name) {
  appendSetCookie(res, `${name}=; ${cookieOptions(0)}`);
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  return value;
}

function signSession(discordId) {
  const payload = Buffer.from(JSON.stringify({
    discordId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readSession(req) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest();
  let received;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof session.discordId !== 'string' || session.expiresAt <= Date.now() / 1000) return null;
    return { discordId: session.discordId };
  } catch {
    return null;
  }
}

module.exports = {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  STATE_COOKIE,
  clearCookie,
  getCookie,
  readSession,
  setCookie,
  signSession,
};
