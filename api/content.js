const { getFirestore } = require('./_lib/db');
const { allowMethods, sendJson } = require('./_lib/http');

module.exports = async function getSiteContent(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  try {
    const requestedType = new URL(req.url, 'http://localhost').searchParams.get('type');
    if (requestedType && requestedType !== 'builder') {
      sendJson(res, 400, { error: 'Choose a valid content type.' });
      return;
    }
    const content = getFirestore().collection('veilSiteContent');
    const snapshot = await content.where('type', '==', 'builder').get();
    sendJson(res, 200, {
      overrides: snapshot.docs.map(document => {
        const { type, collection, id, record, deleted } = document.data();
        return { type, collection, id, record: record || null, deleted: deleted === true };
      }),
    });
  } catch (error) {
    console.error('[site-content] Unable to load shared content:', error);
    sendJson(res, 500, { error: 'Unable to load shared site content right now.' });
  }
};
