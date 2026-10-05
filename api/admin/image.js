const crypto = require('node:crypto');
const { put } = require('@vercel/blob');
const { allowMethods, readJsonBody, requireSameOrigin, sendJson } = require('../_lib/http');
const { requireAdmin } = require('../_lib/admin');

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function matchesImageType(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  if (mimeType === 'image/gif') {
    const signature = buffer.toString('ascii', 0, 6);
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  return false;
}

function safeUploadError(error) {
  let message = error instanceof Error ? error.message : 'Unknown upload error.';
  message = message.replace(/^Vercel Blob:\s*/i, '');
  message = message.replace(/https?:\/\/[^\s"'<>]+/gi, value => {
    try {
      const url = new URL(value);
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return '[URL omitted]';
    }
  });
  ['BLOB_READ_WRITE_TOKEN', 'VERCEL_OIDC_TOKEN', 'SESSION_SECRET', 'DISCORD_CLIENT_SECRET']
    .forEach(name => {
      const secret = process.env[name];
      if (secret) message = message.split(secret).join('[redacted]');
    });
  return message.slice(0, 300);
}

module.exports = async function uploadSiteImage(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!requireSameOrigin(req, res)) return;
  try {
    if (!requireAdmin(req, res)) return;
    const body = readJsonBody(req, res, 4_300_000, 'The image upload is too large.');
    if (!body) return;
    if (!MIME_TYPES.has(body.mimeType) || typeof body.data !== 'string') {
      sendJson(res, 400, { error: 'Choose a PNG, JPEG, WebP, or GIF image.' });
      return;
    }
    if (!body.data.startsWith(`data:${body.mimeType};base64,`)) {
      sendJson(res, 400, { error: 'The image data does not match its file type.' });
      return;
    }
    const encoded = body.data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(encoded, 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      sendJson(res, 413, { error: 'Images must be 3 MB or smaller.' });
      return;
    }
    if (!matchesImageType(buffer, body.mimeType)) {
      sendJson(res, 400, { error: 'The selected image file is invalid or does not match its file type.' });
      return;
    }
    const objectPath = `site-content/${crypto.randomUUID()}.${EXTENSIONS[body.mimeType]}`;
    const blob = await put(objectPath, buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: body.mimeType,
      multipart: false,
    });
    sendJson(res, 201, { imageUrl: blob.url });
  } catch (error) {
    console.error('[admin-image] Unable to upload site image:', error);
    const message = error instanceof Error ? error.message : '';
    if (/No blob credentials found|no storeId was found/i.test(message)) {
      sendJson(res, 503, {
        error: 'Vercel Blob authentication is unavailable. Connect the production project to its Blob store with OIDC, or configure that store’s read/write token.',
      });
      return;
    }
    if (/OIDC is enabled for this project, but not for this token's environment/i.test(message)) {
      sendJson(res, 503, {
        error: 'Vercel Blob OIDC is not enabled for this deployment environment. Enable OIDC for production or configure the store’s read/write token.',
      });
      return;
    }
    if (/Access denied|This store does not exist/i.test(message)) {
      sendJson(res, 503, {
        error: 'Vercel Blob rejected this project’s credentials. Confirm the production project is connected to the correct Blob store and has upload access.',
      });
      return;
    }
    if (/Cannot use public access on a private store/i.test(message)) {
      sendJson(res, 503, {
        error: 'This Blob store is private, but site images must be public. Connect a public Vercel Blob store to this project and retry.',
      });
      return;
    }
    sendJson(res, 502, { error: `Image upload failed: ${safeUploadError(error)}` });
  }
};
