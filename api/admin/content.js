const { getFirestore } = require('../_lib/db');
const { allowMethods, readJsonBody, requireSameOrigin, sendJson } = require('../_lib/http');
const { requireAdmin } = require('../_lib/admin');

const BUILDER_COLLECTIONS = new Set([
  'races', 'masteries', 'classes', 'abilities', 'auras', 'dashes', 'accessories',
  'outfits', 'racePassives', 'weapons', 'accessoryOutfitEnchants', 'weaponEnchants', 'gems',
]);
function validateContent(body, res) {
  const { type, collection, record, deleted } = body;
  if (type !== 'builder' || typeof collection !== 'string' || !BUILDER_COLLECTIONS.has(collection)) {
    sendJson(res, 400, { error: 'Choose a supported builder collection.' });
    return null;
  }
  if (typeof body.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(body.id)) {
    sendJson(res, 400, { error: 'Entry IDs can contain letters, numbers, underscores, and hyphens only.' });
    return null;
  }
  if (body.previousId !== undefined
      && (typeof body.previousId !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(body.previousId))) {
    sendJson(res, 400, { error: 'The previous entry ID is invalid.' });
    return null;
  }
  if (deleted === true) return { type, collection, id: body.id, deleted: true };
  if (!record || typeof record !== 'object' || Array.isArray(record)
      || record.id !== body.id || typeof record.name !== 'string' || !record.name.trim()) {
    sendJson(res, 400, { error: 'An entry must have a matching ID and a non-empty name.' });
    return null;
  }
  return {
    type,
    collection,
    id: body.id,
    previousId: body.previousId,
    deleted: false,
    record,
  };
}

module.exports = async function updateSiteContent(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!requireSameOrigin(req, res)) return;
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const body = readJsonBody(req, res, 250_000, 'This content entry is too large to save.');
    if (!body) return;
    const content = validateContent(body, res);
    if (!content) return;
    const firestore = getFirestore();
    const overrides = firestore.collection('veilSiteContent');
    const documentIdFor = id => Buffer.from(`${content.type}:${content.collection}:${id}`).toString('base64url');
    const destinationRef = overrides.doc(documentIdFor(content.id));
    if (content.previousId && content.previousId !== content.id) {
      const destinationSnapshot = await destinationRef.get();
      if (destinationSnapshot.exists && destinationSnapshot.data().deleted !== true) {
        sendJson(res, 409, { error: 'That ID is already used by another entry in this section.' });
        return;
      }
      const now = new Date();
      const batch = firestore.batch();
      batch.set(overrides.doc(documentIdFor(content.previousId)), {
        type: content.type,
        collection: content.collection,
        id: content.previousId,
        deleted: true,
        updatedAt: now,
        updatedBy: admin.discordId,
      });
      batch.set(destinationRef, {
        type: content.type,
        collection: content.collection,
        id: content.id,
        deleted: false,
        record: content.record,
        updatedAt: now,
        updatedBy: admin.discordId,
      });
      await batch.commit();
    } else {
      const destinationSnapshot = await destinationRef.get();
      if (!content.previousId && destinationSnapshot.exists && destinationSnapshot.data().deleted !== true) {
        sendJson(res, 409, { error: 'That ID is already used by another entry in this section.' });
        return;
      }
      await destinationRef.set({
        type: content.type,
        collection: content.collection,
        id: content.id,
        deleted: false,
        record: content.record,
        updatedAt: new Date(),
        updatedBy: admin.discordId,
      });
    }
    sendJson(res, 200, { saved: true });
  } catch (error) {
    console.error('[admin-content] Unable to save site content:', error);
    sendJson(res, 500, { error: 'Unable to save site content right now.' });
  }
};
