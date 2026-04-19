
require('dotenv').config();
const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp;

const initializeFirebase = () => {
  if (firebaseApp) return firebaseApp;
  
  try {

    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log("privatekey", process.env.FIREBASE_CLIENT_EMAIL);
    logger.info('Firebase Admin initialized');
  } catch (error) {
    logger.error(` Firebase initialization error: ${error.message}`);
    throw error;
  }

  return firebaseApp;
};

initializeFirebase();

module.exports = {
  admin,
  db: () => admin.database(),
  firestore: () => admin.firestore(),
  auth: () => admin.auth(),
  messaging: () => admin.messaging(),
};