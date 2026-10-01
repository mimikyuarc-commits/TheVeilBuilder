const crypto = require('node:crypto');
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

module.exports = async function builds(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;
  try {
    if (req.method === 'GET') {
      const user = getUser(req, res);
      if (!user) return;
      const db = getFirestore();
      const userRef = db.collection('veilUsers').doc(user.discordId);
      const [result, userSnapshot] = await Promise.all([
        userRef.collection('builds').orderBy('updatedAt', 'desc').limit(100).get(),
        userRef.get(),
      ]);
      const profile = userSnapshot.exists ? userSnapshot.data() : {};
      sendJson(res, 200, {
        builds: result.docs.map(document => {
          const saved = document.data();
          return {
            id: document.id,
            name: saved.name,
            is_public: saved.isPublic,
            data: saved.data,
            author: saved.ownerName,
            avatar_url: saved.ownerAvatar || profile.avatarUrl || null,
            created_at: serializeTimestamp(saved.createdAt),
            updated_at: serializeTimestamp(saved.updatedAt),
          };
        }),
      });
      return;
    }

    if (!requireSameOrigin(req, res)) return;
    const user = getUser(req, res);
    if (!user) return;
    const body = readJsonBody(req, res);
    if (!body) return;
    const build = parseBuild(body, res);
    if (!build) return;

    const id = crypto.randomUUID();
    const db = getFirestore();
    const userRef = db.collection('veilUsers').doc(user.discordId);
    const userSnapshot = await userRef.get();
    const profile = userSnapshot.exists ? userSnapshot.data() : {};
    const buildRef = userRef.collection('builds').doc(id);
    const now = new Date();
    const record = {
      ownerId: user.discordId,
      ownerName: profile.displayName || profile.username || user.discordId,
      ownerAvatar: profile.avatarUrl || null,
      name: build.name,
      isPublic: build.isPublic,
      data: build.data,
      createdAt: now,
      updatedAt: now,
    };
    const batch = db.batch();
    batch.set(buildRef, record);
    if (build.isPublic) batch.set(db.collection('veilPublicBuilds').doc(id), record);
    batch.set(userRef, { discordId: user.discordId, updatedAt: now }, { merge: true });
    await batch.commit();
    sendJson(res, 201, {
      build: {
        id,
        name: record.name,
        is_public: record.isPublic,
        data: record.data,
        author: record.ownerName,
        avatar_url: record.ownerAvatar,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('[cloud-builds] Unable to load or save builds:', error);
    sendJson(res, 500, { error: 'Unable to access cloud builds right now.' });
  }
};
