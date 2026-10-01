const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore: initializeFirestore } = require('firebase-admin/firestore');

function getFirestore() {
  if (!getApps().length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    let credential;

    if (serviceAccountJson) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
      } catch {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.');
      }
      credential = cert(serviceAccount);
    } else {
      const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
      if (!projectId || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        throw new Error('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in Vercel.');
      }
      credential = cert({
        projectId,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    }

    initializeApp({ credential, ...(projectId ? { projectId } : {}) });
  }
  return initializeFirestore();
}

function serializeTimestamp(value) {
  return value && typeof value.toDate === 'function' ? value.toDate().toISOString() : null;
}

module.exports = { getFirestore, serializeTimestamp };
