import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { connectToWhatsApp, disconnectWhatsApp, getSocket } from '../services/whatsapp.js';
import { db } from '../config/firebase.js';
import { addMessage } from '../services/db.js';

/**
 * Trigger WhatsApp connection
 */
export async function handleConnect(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    // Start Baileys connection in background
    connectToWhatsApp(userId).catch(err => {
      console.error(`Background connection failed for user ${userId}:`, err);
    });
    res.json({ success: true, message: 'WhatsApp connection process initiated.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to initiate connection.', details: err.message });
  }
}

/**
 * Disconnect WhatsApp connection and clean session files
 */
export async function handleDisconnect(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    await disconnectWhatsApp(userId);
    res.json({ success: true, message: 'WhatsApp connection terminated.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to disconnect WhatsApp.', details: err.message });
  }
}

/**
 * Fetch current WhatsApp connection status
 */
export async function handleGetStatus(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    const doc = await db.collection('settings').doc(`${userId}_connection`).get();
    if (!doc.exists) {
      return res.json({ status: 'disconnected', qr: null, phone: null, error: null });
    }
    res.json(doc.data());
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve connection status.', details: err.message });
  }
}

/**
 * Send a manual message via the WhatsApp socket
 */
export async function handleSendMessage(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  const { jid, text } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  if (!jid || !text) {
    return res.status(400).json({ error: 'Missing recipient JID or text content.' });
  }

  try {
    const sock = getSocket(userId);
    if (!sock) {
      return res.status(400).json({ error: 'WhatsApp client is not connected for this user.' });
    }

    // Send the message over WhatsApp Web socket
    await sock.sendMessage(jid, { text });

    // Store outgoing message in history
    await addMessage(userId, {
      contactId: jid,
      fromMe: true,
      body: text,
      type: 'text',
      aiReplied: false,
    });

    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send WhatsApp message.', details: err.message });
  }
}
