import admin from 'firebase-admin';
import fs from 'fs';
import { CONFIG } from './env.js';

let app: admin.app.App;

try {
  if (CONFIG.FIREBASE_SERVICE_ACCOUNT) {
    let credentialData: any;
    if (CONFIG.FIREBASE_SERVICE_ACCOUNT.trim().startsWith('{')) {
      credentialData = JSON.parse(CONFIG.FIREBASE_SERVICE_ACCOUNT);
    } else {
      const filePath = CONFIG.FIREBASE_SERVICE_ACCOUNT;
      if (fs.existsSync(filePath)) {
        credentialData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else {
        throw new Error(`Firebase service account file not found at: ${filePath}`);
      }
    }
    
    app = admin.initializeApp({
      credential: admin.credential.cert(credentialData),
      projectId: credentialData.project_id || CONFIG.FIREBASE_PROJECT_ID
    });
    console.log('Firebase Admin SDK initialized using service account credentials.');
  } else {
    // Try default credentials or project ID only (e.g. firestore emulator or standard env setup)
    app = admin.initializeApp({
      projectId: CONFIG.FIREBASE_PROJECT_ID || undefined
    });
    console.log('Firebase Admin SDK initialized using default credentials.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  // Re-throw or proceed with mock for build checks
  app = admin.apps.length > 0 ? admin.app() : admin.initializeApp({ projectId: 'mock-project' });
}

export const db = admin.firestore(app);
export const auth = admin.auth(app);
export const storage = admin.storage(app);

// Enable Timestamp settings
db.settings({ ignoreUndefinedProperties: true });
