const { getFirestore } = require('../_lib/db');
const { allowMethods, sendJson } = require('../_lib/http');
const { readSession } = require('../_lib/session');

module.exports = async function getCurrentUser(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  try {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 200, { authenticated: false });
      return;
    }
    const userSnapshot = await getFirestore().collection('veilUsers').doc(session.discordId).get();
    if (!userSnapshot.exists) {
      sendJson(res, 200, { authenticated: false });
      return;
    }
    const user = userSnapshot.data();
    sendJson(res, 200, {
      authenticated: true,
      user: {
        id: session.discordId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('[auth-me] Unable to load account:', error);
    sendJson(res, 500, { error: 'Unable to check your account right now.' });
  }
};
