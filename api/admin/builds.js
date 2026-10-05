const { getFirestore, serializeTimestamp } = require('../_lib/db');
const { allowMethods, sendJson } = require('../_lib/http');
const { requireAdmin } = require('../_lib/admin');

module.exports = async function listBuilds(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  try {
    if (!requireAdmin(req, res)) return;
    const db = getFirestore();
    const cursorPath = new URL(req.url, 'http://localhost').searchParams.get('cursor');
    let query = db.collectionGroup('builds')
      .orderBy('updatedAt', 'desc')
      .limit(201);
    if (cursorPath) {
      if (!/^veilUsers\/\d{17,20}\/builds\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cursorPath)) {
        sendJson(res, 400, { error: 'Invalid build-list cursor.' });
        return;
      }
      const cursor = await db.doc(cursorPath).get();
      if (!cursor.exists) {
        sendJson(res, 400, { error: 'The build-list cursor is no longer available. Refresh the list.' });
        return;
      }
      query = query.startAfter(cursor);
    }
    const result = await query.get();
    const page = result.docs.slice(0, 200);
    sendJson(res, 200, {
      builds: page.map(document => {
        const build = document.data();
        const ownerId = build.ownerId || document.ref.parent.parent.id;
        return {
          id: document.id,
          ownerId,
          ownerName: build.ownerName || ownerId,
          ownerAvatar: build.ownerAvatar || null,
          name: build.name,
          is_public: build.isPublic === true,
          data: build.data,
          created_at: serializeTimestamp(build.createdAt),
          updated_at: serializeTimestamp(build.updatedAt),
        };
      }),
      nextCursor: result.docs.length > 200 ? page[page.length - 1].ref.path : null,
    });
  } catch (error) {
    console.error('[admin-builds] Unable to list cloud builds:', error);
    sendJson(res, 500, { error: 'Unable to load cloud builds right now.' });
  }
};
