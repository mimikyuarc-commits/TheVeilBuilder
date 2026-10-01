const { getFirestore, serializeTimestamp } = require('./_lib/db');
const { allowMethods, sendJson } = require('./_lib/http');

module.exports = async function publicBuilds(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  try {
    const db = getFirestore();
    const result = await db.collection('veilPublicBuilds')
      .orderBy('updatedAt', 'desc').limit(100).get();
    const missingAvatars = [...new Set(result.docs
      .filter(document => !document.data().ownerAvatar && document.data().ownerId)
      .map(document => document.data().ownerId))];
    const userProfiles = missingAvatars.length
      ? await db.getAll(...missingAvatars.map(id => db.collection('veilUsers').doc(id)))
      : [];
    const avatarsByUserId = new Map(userProfiles
      .filter(profile => profile.exists)
      .map(profile => [profile.id, profile.data().avatarUrl || null]));
    sendJson(res, 200, {
      builds: result.docs.map(document => {
        const build = document.data();
        return {
          id: document.id,
          name: build.name,
          data: build.data,
          updated_at: serializeTimestamp(build.updatedAt),
          author: build.ownerName,
          avatar_url: build.ownerAvatar || avatarsByUserId.get(build.ownerId) || null,
        };
      }),
    }, { 'Cache-Control': 'public, max-age=30, s-maxage=30' });
  } catch (error) {
    console.error('[public-builds] Unable to load gallery:', error);
    sendJson(res, 500, { error: 'Unable to load public builds right now.' });
  }
};
