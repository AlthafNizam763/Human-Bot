"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocket = getSocket;
exports.connectToWhatsApp = connectToWhatsApp;
exports.disconnectWhatsApp = disconnectWhatsApp;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const qrcode_1 = __importDefault(require("qrcode"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const env_js_1 = require("../config/env.js");
const firebase_js_1 = require("../config/firebase.js");
const db_js_1 = require("./db.js");
const message_js_1 = require("../handlers/message.js");
// Map to store active sockets by userId
const activeSockets = new Map();
// Map to track connection status by userId
const connectionStatuses = new Map();
/**
 * Get active socket instance for a user
 */
function getSocket(userId) {
    return activeSockets.get(userId);
}
/**
 * Update connection status in memory and Firestore for real-time frontend syncing
 */
async function updateConnectionState(userId, state, metadata = {}) {
    connectionStatuses.set(userId, state);
    const statusData = {
        status: state,
        qr: metadata.qr || null,
        phone: metadata.phone || null,
        error: metadata.error || null,
        updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
    };
    try {
        await firebase_js_1.db.collection('settings').doc(`${userId}_connection`).set(statusData, { merge: true });
    }
    catch (err) {
        console.error(`Failed to update firestore connection state for ${userId}:`, err);
    }
}
/**
 * Initialize and connect to WhatsApp for a specific user
 */
async function connectToWhatsApp(userId) {
    // If already connected or connecting, return the existing one
    if (activeSockets.has(userId) && connectionStatuses.get(userId) === 'connected') {
        return activeSockets.get(userId);
    }
    const sessionPath = path_1.default.join(env_js_1.CONFIG.WHATSAPP_SESSION_DIR, userId);
    // Ensure session path exists
    if (!fs_1.default.existsSync(sessionPath)) {
        fs_1.default.mkdirSync(sessionPath, { recursive: true });
    }
    await updateConnectionState(userId, 'connecting');
    await (0, db_js_1.writeLog)(userId, 'info', 'Initializing WhatsApp connection state...');
    const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(sessionPath);
    // Fetch the latest WhatsApp Web version to avoid 405 Method Not Allowed error
    const { version } = await (0, baileys_1.fetchLatestBaileysVersion)().catch(() => ({
        version: [2, 3000, 1035194821]
    }));
    const sock = (0, baileys_1.default)({
        version,
        auth: state,
        printQRInTerminal: false, // Don't flood terminal since SaaS dashboard reads QR
        logger: (0, pino_1.default)({ level: 'silent' }), // Disable Baileys verbose logger
        browser: baileys_1.Browsers.macOS('Desktop'),
        syncFullHistory: false
    });
    activeSockets.set(userId, sock);
    // Monitor connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            try {
                // Convert QR code to Data URL for frontend display
                const qrDataUrl = await qrcode_1.default.toDataURL(qr);
                await updateConnectionState(userId, 'qr', { qr: qrDataUrl });
                await (0, db_js_1.writeLog)(userId, 'info', 'New QR Code generated.');
            }
            catch (err) {
                console.error('Error generating QR Data URL', err);
            }
        }
        if (connection === 'connecting') {
            await updateConnectionState(userId, 'connecting');
        }
        if (connection === 'open') {
            const phoneJid = sock.user?.id || '';
            const cleanPhone = phoneJid.split(':')[0] || phoneJid.split('@')[0];
            await updateConnectionState(userId, 'connected', { phone: cleanPhone });
            await (0, db_js_1.writeLog)(userId, 'info', `WhatsApp connected successfully. JID: ${phoneJid}`, { phone: cleanPhone });
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode || 500;
            const shouldReconnect = statusCode !== baileys_1.DisconnectReason.loggedOut;
            console.log(`Connection closed for user ${userId}. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);
            if (statusCode === baileys_1.DisconnectReason.loggedOut) {
                await updateConnectionState(userId, 'disconnected', { error: 'Logged out from WhatsApp' });
                await (0, db_js_1.writeLog)(userId, 'warn', 'WhatsApp session logged out. Cleaning up session files.');
                // Cleanup credentials directory
                activeSockets.delete(userId);
                fs_1.default.rmSync(sessionPath, { recursive: true, force: true });
            }
            else {
                await updateConnectionState(userId, 'disconnected', { error: 'Connection lost. Reconnecting...' });
                await (0, db_js_1.writeLog)(userId, 'warn', 'WhatsApp disconnected. Reconnecting in 5 seconds...', { statusCode });
                // Reconnect after delay
                setTimeout(() => {
                    connectToWhatsApp(userId);
                }, 5000);
            }
        }
    });
    // Save auth state credentials whenever updated
    sock.ev.on('creds.update', saveCreds);
    // Listen for incoming messages
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        if (chatUpdate.type === 'notify') {
            for (const msg of chatUpdate.messages) {
                // Run handler asynchronously to prevent blocking socket thread
                (0, message_js_1.handleIncomingMessage)(userId, sock, msg).catch((err) => {
                    (0, db_js_1.writeLog)(userId, 'error', 'Error in message handling handler', {
                        error: err.message,
                        stack: err.stack,
                        messageId: msg.key.id
                    });
                });
            }
        }
    });
    return sock;
}
/**
 * Gracefully disconnect and delete the session configuration
 */
async function disconnectWhatsApp(userId) {
    const sock = activeSockets.get(userId);
    if (sock) {
        try {
            sock.logout();
            sock.end(new Error('Manual disconnect triggered'));
        }
        catch (e) {
            console.error('Error during socket end:', e);
        }
        activeSockets.delete(userId);
    }
    const sessionPath = path_1.default.join(env_js_1.CONFIG.WHATSAPP_SESSION_DIR, userId);
    if (fs_1.default.existsSync(sessionPath)) {
        fs_1.default.rmSync(sessionPath, { recursive: true, force: true });
    }
    await updateConnectionState(userId, 'disconnected');
    await (0, db_js_1.writeLog)(userId, 'info', 'WhatsApp session disconnected and deleted.');
}
