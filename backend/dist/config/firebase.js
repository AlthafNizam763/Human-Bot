"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.auth = exports.db = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const fs_1 = __importDefault(require("fs"));
const env_js_1 = require("./env.js");
let app;
try {
    if (env_js_1.CONFIG.FIREBASE_SERVICE_ACCOUNT) {
        let credentialData;
        if (env_js_1.CONFIG.FIREBASE_SERVICE_ACCOUNT.trim().startsWith('{')) {
            credentialData = JSON.parse(env_js_1.CONFIG.FIREBASE_SERVICE_ACCOUNT);
        }
        else {
            const filePath = env_js_1.CONFIG.FIREBASE_SERVICE_ACCOUNT;
            if (fs_1.default.existsSync(filePath)) {
                credentialData = JSON.parse(fs_1.default.readFileSync(filePath, 'utf8'));
            }
            else {
                throw new Error(`Firebase service account file not found at: ${filePath}`);
            }
        }
        app = firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(credentialData),
            projectId: credentialData.project_id || env_js_1.CONFIG.FIREBASE_PROJECT_ID
        });
        console.log('Firebase Admin SDK initialized using service account credentials.');
    }
    else {
        // Try default credentials or project ID only (e.g. firestore emulator or standard env setup)
        app = firebase_admin_1.default.initializeApp({
            projectId: env_js_1.CONFIG.FIREBASE_PROJECT_ID || undefined
        });
        console.log('Firebase Admin SDK initialized using default credentials.');
    }
}
catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    // Re-throw or proceed with mock for build checks
    app = firebase_admin_1.default.apps.length > 0 ? firebase_admin_1.default.app() : firebase_admin_1.default.initializeApp({ projectId: 'mock-project' });
}
exports.db = firebase_admin_1.default.firestore(app);
exports.auth = firebase_admin_1.default.auth(app);
exports.storage = firebase_admin_1.default.storage(app);
// Enable Timestamp settings
exports.db.settings({ ignoreUndefinedProperties: true });
