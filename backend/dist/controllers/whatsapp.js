"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleConnect = handleConnect;
exports.handleDisconnect = handleDisconnect;
exports.handleGetStatus = handleGetStatus;
exports.handleSendMessage = handleSendMessage;
const whatsapp_js_1 = require("../services/whatsapp.js");
const firebase_js_1 = require("../config/firebase.js");
const db_js_1 = require("../services/db.js");
/**
 * Trigger WhatsApp connection
 */
async function handleConnect(req, res) {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(400).json({ error: 'Missing user context.' });
    }
    try {
        // Start Baileys connection in background
        (0, whatsapp_js_1.connectToWhatsApp)(userId).catch(err => {
            console.error(`Background connection failed for user ${userId}:`, err);
        });
        res.json({ success: true, message: 'WhatsApp connection process initiated.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to initiate connection.', details: err.message });
    }
}
/**
 * Disconnect WhatsApp connection and clean session files
 */
async function handleDisconnect(req, res) {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(400).json({ error: 'Missing user context.' });
    }
    try {
        await (0, whatsapp_js_1.disconnectWhatsApp)(userId);
        res.json({ success: true, message: 'WhatsApp connection terminated.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to disconnect WhatsApp.', details: err.message });
    }
}
/**
 * Fetch current WhatsApp connection status
 */
async function handleGetStatus(req, res) {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(400).json({ error: 'Missing user context.' });
    }
    try {
        const doc = await firebase_js_1.db.collection('settings').doc(`${userId}_connection`).get();
        if (!doc.exists) {
            return res.json({ status: 'disconnected', qr: null, phone: null, error: null });
        }
        res.json(doc.data());
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve connection status.', details: err.message });
    }
}
/**
 * Send a manual message via the WhatsApp socket
 */
async function handleSendMessage(req, res) {
    const userId = req.user?.uid;
    const { jid, text } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'Missing user context.' });
    }
    if (!jid || !text) {
        return res.status(400).json({ error: 'Missing recipient JID or text content.' });
    }
    try {
        const sock = (0, whatsapp_js_1.getSocket)(userId);
        if (!sock) {
            return res.status(400).json({ error: 'WhatsApp client is not connected for this user.' });
        }
        // Send the message over WhatsApp Web socket
        await sock.sendMessage(jid, { text });
        // Store outgoing message in history
        await (0, db_js_1.addMessage)(userId, {
            contactId: jid,
            fromMe: true,
            body: text,
            type: 'text',
            aiReplied: false,
        });
        res.json({ success: true, message: 'Message sent successfully.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to send WhatsApp message.', details: err.message });
    }
}
