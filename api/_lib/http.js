function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  res.end(JSON.stringify(body));
}

function allowMethods(req, res, methods) {
  res.setHeader('Allow', methods.join(', '));
  if (!methods.includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return false;
  }
  return true;
}

function requireSameOrigin(req, res) {
  const origin = req.headers.origin;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!origin || !host) {
    sendJson(res, 403, { error: 'This request must come from the app.' });
    return false;
  }

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    sendJson(res, 403, { error: 'This request must come from the app.' });
    return false;
  }

  if (originHost !== host) {
    sendJson(res, 403, { error: 'This request must come from the app.' });
    return false;
  }
  return true;
}

function readJsonBody(req, res, maxBytes = 40_000) {
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > maxBytes) {
      sendJson(res, 413, { error: 'The build is too large to save.' });
      return null;
    }
    try {
      body = JSON.parse(body);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON request.' });
      return null;
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    sendJson(res, 400, { error: 'A JSON object is required.' });
    return null;
  }
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBytes) {
    sendJson(res, 413, { error: 'The build is too large to save.' });
    return null;
  }
  return body;
}

module.exports = { allowMethods, readJsonBody, requireSameOrigin, sendJson };
