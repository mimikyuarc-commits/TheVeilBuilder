const { getFirestore, serializeTimestamp } = require('../_lib/db');
const { parseBuild } = require('../_lib/build');
const { allowMethods, readJsonBody, requireSameOrigin, sendJson } = require('../_lib/http');
const { readSession } = require('../_lib/session');

function getUser(req, res) {
  const session = readSession(req);
  if (!session) {
    sendJson(res, 401, { error: 'Connect your Discord account to use cloud builds.' });
    return null;
  }
  return session;
}

module.exports = async function updateOrDeleteBuild(req, res) {
  if (!allowMethods(req, res, ['PUT', 'DELETE'])) return;
  if (!requireSameOrigin(req, res)) return;
  const user = getUser(req, res);
  if (!user) return;
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    sendJson(res, 400, { error: 'Invalid build id.' });
    return;
  }

  try {
    const db = getFirestore();
    const buildRef = db.collection('veilUsers').doc(user.discordId).collection('builds').doc(id);
    if (req.method === 'DELETE') {
      const existing = await buildRef.get();
      if (!existing.exists) {
        sendJson(res, 404, { error: 'Build not found.' });
        return;
      }
      const batch = db.batch();
      batch.delete(buildRef);
      batch.delete(db.collection('veilPublicBuilds').doc(id));
      await batch.commit();
      sendJson(res, 200, { ok: true });
      return;
    }

    const body = readJsonBody(req, res);
    if (!body) return;
    const build = parseBuild(body, res);
    if (!build) return;
    const existing = await buildRef.get();
    if (!existing.exists) {
      sendJson(res, 404, { error: 'Build not found.' });
      return;
    }
    const previous = existing.data();
    const userSnapshot = previous.ownerAvatar
      ? null
      : await db.collection('veilUsers').doc(user.discordId).get();
    const profile = userSnapshot && userSnapshot.exists ? userSnapshot.data() : {};
    const now = new Date();
    const record = {
      ownerId: user.discordId,
      ownerName: profile.displayName || profile.username || previous.ownerName || user.discordId,
      ownerAvatar: previous.ownerAvatar || profile.avatarUrl || null,
      name: build.name,
      isPublic: build.isPublic,
      data: build.data,
      createdAt: previous.createdAt || now,
      updatedAt: now,
    };
    const batch = db.batch();
    batch.set(buildRef, record);
    const publicRef = db.collection('veilPublicBuilds').doc(id);
    if (build.isPublic) batch.set(publicRef, record);
    else batch.delete(publicRef);
    await batch.commit();
    sendJson(res, 200, {
      build: {
        id,
        name: record.name,
        is_public: record.isPublic,
        data: record.data,
        author: record.ownerName,
        avatar_url: record.ownerAvatar,
        created_at: serializeTimestamp(record.createdAt) || now.toISOString(),
        updated_at: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('[cloud-builds] Unable to update or delete build:', error);
    sendJson(res, 500, { error: 'Unable to update this cloud build right now.' });
  }
};
