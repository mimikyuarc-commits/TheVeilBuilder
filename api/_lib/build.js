const { sendJson } = require('./http');

function parseBuild(body, res) {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name) {
    sendJson(res, 400, { error: 'Enter a build name before saving.' });
    return null;
  }
  if (typeof body.isPublic !== 'boolean'
      || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    sendJson(res, 400, { error: 'The build data or visibility setting is invalid.' });
    return null;
  }

  const allowedKeys = [
    'raceId', 'masteryId', 'prestige', 'classId', 'abilityId', 'auraId', 'dashId',
    'accessories', 'outfitId', 'outfitEnchants', 'weapons', 'gemId', 'customModifiers',
    'accessoryEnchants', 'weaponEnchants',
  ];
  const data = { name };
  allowedKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(body.data, key)) data[key] = body.data[key];
  });
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 30_000) {
    sendJson(res, 413, { error: 'This build is too large to save.' });
    return null;
  }
  return { name, isPublic: body.isPublic, data };
}

module.exports = { parseBuild };
