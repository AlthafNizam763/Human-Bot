import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  delay,
  Browsers,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import admin from 'firebase-admin';
import { CONFIG } from '../config/env.js';
import { db } from '../config/firebase.js';
import { writeLog } from './db.js';
import { handleIncomingMessage } from '../handlers/message.js';

// Map to store active sockets by userId
const activeSockets = new Map<string, WASocket>();

// Map to track connection status by userId
const connectionStatuses = new Map<string, string>();

/**
 * Get active socket instance for a user
 */
export function getSocket(userId: string): WASocket | undefined {
  return activeSockets.get(userId);
}

/**
 * Update connection status in memory and Firestore for real-time frontend syncing
 */
async function updateConnectionState(
  userId: string,
  state: 'disconnected' | 'connecting' | 'connected' | 'qr',
  metadata: { qr?: string; phone?: string; error?: string } = {}
) {
  connectionStatuses.set(userId, state);
  
  const statusData = {
    status: state,
    qr: metadata.qr || null,
    phone: metadata.phone || null,
    error: metadata.error || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await db.collection('settings').doc(`${userId}_connection`).set(statusData, { merge: true });
  } catch (err) {
    console.error(`Failed to update firestore connection state for ${userId}:`, err);
  }
}

/**
 * Initialize and connect to WhatsApp for a specific user
 */
export async function connectToWhatsApp(userId: string): Promise<WASocket> {
  // If already connected or connecting, return the existing one
  if (activeSockets.has(userId) && connectionStatuses.get(userId) === 'connected') {
    return activeSockets.get(userId)!;
  }

  const sessionPath = path.join(CONFIG.WHATSAPP_SESSION_DIR, userId);
  
  // Ensure session path exists
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  await updateConnectionState(userId, 'connecting');
  await writeLog(userId, 'info', 'Initializing WhatsApp connection state...');

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  // Fetch the latest WhatsApp Web version to avoid 405 Method Not Allowed error
  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1035194821] as [number, number, number]
  }));

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // Don't flood terminal since SaaS dashboard reads QR
    logger: pino({ level: 'silent' }), // Disable Baileys verbose logger
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false
  });

  activeSockets.set(userId, sock);

  // Monitor connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        // Convert QR code to Data URL for frontend display
        const qrDataUrl = await QRCode.toDataURL(qr);
        await updateConnectionState(userId, 'qr', { qr: qrDataUrl });
        await writeLog(userId, 'info', 'New QR Code generated.');
      } catch (err) {
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
      await writeLog(userId, 'info', `WhatsApp connected successfully. JID: ${phoneJid}`, { phone: cleanPhone });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || 500;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`Connection closed for user ${userId}. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);

      if (statusCode === DisconnectReason.loggedOut) {
        await updateConnectionState(userId, 'disconnected', { error: 'Logged out from WhatsApp' });
        await writeLog(userId, 'warn', 'WhatsApp session logged out. Cleaning up session files.');
        
        // Cleanup credentials directory
        activeSockets.delete(userId);
        fs.rmSync(sessionPath, { recursive: true, force: true });
      } else {
        await updateConnectionState(userId, 'disconnected', { error: 'Connection lost. Reconnecting...' });
        await writeLog(userId, 'warn', 'WhatsApp disconnected. Reconnecting in 5 seconds...', { statusCode });
        
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
        handleIncomingMessage(userId, sock, msg).catch((err) => {
          writeLog(userId, 'error', 'Error in message handling handler', {
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
export async function disconnectWhatsApp(userId: string): Promise<void> {
  const sock = activeSockets.get(userId);
  if (sock) {
    try {
      sock.logout();
      sock.end(new Error('Manual disconnect triggered'));
    } catch (e) {
      console.error('Error during socket end:', e);
    }
    activeSockets.delete(userId);
  }
  
  const sessionPath = path.join(CONFIG.WHATSAPP_SESSION_DIR, userId);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }
  
  await updateConnectionState(userId, 'disconnected');
  await writeLog(userId, 'info', 'WhatsApp session disconnected and deleted.');
}
