const { getFirestore, serializeTimestamp } = require('../../_lib/db');
const { parseBuild } = require('../../_lib/build');
const { allowMethods, readJsonBody, requireSameOrigin, sendJson } = require('../../_lib/http');
const { requireAdmin } = require('../../_lib/admin');

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = async function manageBuild(req, res) {
  if (!allowMethods(req, res, ['PUT', 'DELETE'])) return;
  if (!requireSameOrigin(req, res)) return;
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      sendJson(res, 400, { error: 'Invalid build id.' });
      return;
    }
    const body = readJsonBody(req, res);
    if (!body) return;
    const ownerId = typeof body.ownerId === 'string' ? body.ownerId : '';
    if (!/^\d{17,20}$/.test(ownerId)) {
      sendJson(res, 400, { error: 'Invalid build creator.' });
      return;
    }
    const build = req.method === 'PUT' ? parseBuild(body, res) : null;
    if (req.method === 'PUT' && !build) return;

    const db = getFirestore();
    const buildRef = db.collection('veilUsers').doc(ownerId).collection('builds').doc(id);
    const publicRef = db.collection('veilPublicBuilds').doc(id);
    const result = await db.runTransaction(async transaction => {
      const existing = await transaction.get(buildRef);
      if (!existing.exists) throw requestError(404, 'Build not found.');
      const previous = existing.data();
      if (previous.ownerId && previous.ownerId !== ownerId) {
        throw requestError(404, 'Build not found.');
      }
      const publicSnapshot = await transaction.get(publicRef);
      if (publicSnapshot.exists && publicSnapshot.data().ownerId
          && publicSnapshot.data().ownerId !== ownerId) {
        throw requestError(409, 'The public build record does not match its creator.');
      }

      if (req.method === 'DELETE') {
        transaction.delete(buildRef);
        if (publicSnapshot.exists) transaction.delete(publicRef);
        return { deleted: true };
      }

      const now = new Date();
      const updated = {
        ...previous,
        name: build.name,
        isPublic: build.isPublic,
        data: build.data,
        updatedAt: now,
      };
      transaction.set(buildRef, updated);
      if (build.isPublic) transaction.set(publicRef, updated);
      else if (publicSnapshot.exists) transaction.delete(publicRef);
      return { build: updated, now };
    });

    if (result.deleted) {
      sendJson(res, 200, { ok: true });
      return;
    }
    sendJson(res, 200, {
      build: {
        id,
        ownerId,
        ownerName: result.build.ownerName || ownerId,
        ownerAvatar: result.build.ownerAvatar || null,
        name: result.build.name,
        is_public: result.build.isPublic,
        data: result.build.data,
        created_at: serializeTimestamp(result.build.createdAt) || result.now.toISOString(),
        updated_at: result.now.toISOString(),
      },
    });
  } catch (error) {
    if (error.status) {
      sendJson(res, error.status, { error: error.message });
      return;
    }
    console.error('[admin-builds] Unable to update or delete cloud build:', error);
    sendJson(res, 500, { error: 'Unable to update this cloud build right now.' });
  }
};
