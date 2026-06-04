"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIncomingMessage = handleIncomingMessage;
const baileys_1 = require("@whiskeysockets/baileys");
const pino_1 = __importDefault(require("pino"));
const firebase_js_1 = require("../config/firebase.js");
const db_js_1 = require("../services/db.js");
const openai_js_1 = require("../services/openai.js");
const whatsapp_js_1 = require("../services/whatsapp.js");
// In-memory registry to cancel queued replies if the user manually replies
const pendingReplies = new Map();
const logger = (0, pino_1.default)({ level: 'silent' });
/**
 * Main incoming/outgoing WhatsApp message router
 */
async function handleIncomingMessage(userId, sock, msg) {
    const messageId = msg.key.id;
    const fromMe = msg.key.fromMe;
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid)
        return;
    // Ignore status broadcasts
    if (remoteJid === 'status@broadcast')
        return;
    const isGroup = remoteJid.endsWith('@g.us');
    // Load user settings
    const settings = await (0, db_js_1.getSettings)(userId);
    // Extract content
    let textContent = '';
    let mediaType = 'text';
    let imageBase64 = undefined;
    let voiceBuffer = undefined;
    let voiceMimeType = undefined;
    const messageType = Object.keys(msg.message || {})[0];
    if (messageType === 'conversation') {
        textContent = msg.message?.conversation || '';
    }
    else if (messageType === 'extendedTextMessage') {
        textContent = msg.message?.extendedTextMessage?.text || '';
    }
    else if (messageType === 'imageMessage') {
        mediaType = 'image';
        textContent = msg.message?.imageMessage?.caption || '';
        try {
            const buffer = await (0, baileys_1.downloadMediaMessage)(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
            imageBase64 = buffer.toString('base64');
        }
        catch (err) {
            await (0, db_js_1.writeLog)(userId, 'error', 'Failed to download image message', { error: err.message });
        }
    }
    else if (messageType === 'audioMessage') {
        mediaType = 'audio';
        voiceMimeType = msg.message?.audioMessage?.mimetype || 'audio/ogg';
        try {
            voiceBuffer = await (0, baileys_1.downloadMediaMessage)(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
        }
        catch (err) {
            await (0, db_js_1.writeLog)(userId, 'error', 'Failed to download audio message', { error: err.message });
        }
    }
    else if (messageType === 'documentMessage') {
        // Ignore documents by default
        return;
    }
    else {
        // Other message types (reactions, contacts, locations) are ignored or logged
        return;
    }
    // Get sender's name
    const senderName = msg.pushName || remoteJid.split('@')[0];
    // Get or create contact record
    const contact = await (0, db_js_1.getOrCreateContact)(userId, remoteJid, senderName);
    // Update contact name if it changed
    if (msg.pushName && contact.name !== msg.pushName) {
        await (0, db_js_1.updateContact)(userId, remoteJid, { name: msg.pushName });
    }
    // If message is from me, register the human intervention
    if (fromMe) {
        // Save my message in history
        await (0, db_js_1.addMessage)(userId, {
            contactId: remoteJid,
            fromMe: true,
            body: textContent || '[Media/Voice/Image]',
            type: mediaType,
            aiReplied: false,
        });
        // Human intervention check: Cancel any pending auto reply to this contact
        if (pendingReplies.has(remoteJid)) {
            clearTimeout(pendingReplies.get(remoteJid));
            pendingReplies.delete(remoteJid);
            await (0, db_js_1.writeLog)(userId, 'info', `AI response cancelled. Human intervened in chat with: ${contact.name}`);
        }
        // Process Admin commands sent from my own device/account
        if (textContent.startsWith(settings.openaiApiKey ? '/' : '/')) { // Supports standard slash commands
            await handleAdminCommand(userId, sock, remoteJid, textContent, settings);
        }
        return;
    }
    // Save incoming message in history
    await (0, db_js_1.addMessage)(userId, {
        contactId: remoteJid,
        fromMe: false,
        body: textContent || (mediaType === 'audio' ? '[Voice Note]' : '[Image]'),
        type: mediaType,
        aiReplied: false,
    });
    // Group filter
    if (isGroup) {
        const isGroupEnabled = settings.enabledGroups?.includes(remoteJid);
        if (!isGroupEnabled) {
            // Ignore group chats by default
            return;
        }
    }
    // Global settings checks
    if (settings.busyMode) {
        // Busy mode can either disable replying or reply with a busy template
        // By default, let's skip replying
        return;
    }
    if (settings.nightMode) {
        // Check local time (night hours: e.g., 10 PM to 7 AM)
        const currentHour = new Date().getHours();
        if (currentHour >= 22 || currentHour < 7) {
            // In night mode, do not auto reply
            return;
        }
    }
    // Individual contact settings check
    if (!contact.autoReplyEnabled) {
        return;
    }
    // Process Voice Note transcription
    if (mediaType === 'audio' && voiceBuffer) {
        try {
            await (0, db_js_1.writeLog)(userId, 'info', `Transcribing voice note from: ${contact.name}`);
            const transcription = await (0, openai_js_1.transcribeVoiceNote)(voiceBuffer, voiceMimeType || 'audio/ogg', settings.openaiApiKey);
            await (0, db_js_1.writeLog)(userId, 'info', `Transcribed voice note: "${transcription}"`);
            textContent = transcription;
            // Save transcribed text inside message history as well
            await (0, db_js_1.addMessage)(userId, {
                contactId: remoteJid,
                fromMe: false,
                body: `[Voice Note Transcribed]: ${transcription}`,
                type: 'text',
                aiReplied: false,
            });
        }
        catch (err) {
            await (0, db_js_1.writeLog)(userId, 'error', 'Voice note transcription failed', { error: err.message });
            return; // Stop if transcription fails
        }
    }
    // Safety filter check
    if ((0, openai_js_1.isSafetyViolation)(textContent)) {
        await (0, db_js_1.writeLog)(userId, 'warn', `Safety violation detected. Auto reply bypassed for: ${contact.name}`, { message: textContent });
        return;
    }
    // Cancel any existing pending reply to avoid double queues
    if (pendingReplies.has(remoteJid)) {
        clearTimeout(pendingReplies.get(remoteJid));
        pendingReplies.delete(remoteJid);
    }
    // Schedule reply execution with random delay
    const delaySec = Math.floor(Math.random() * (settings.delayMax - settings.delayMin + 1)) + settings.delayMin;
    await (0, db_js_1.writeLog)(userId, 'info', `Scheduling AI reply to ${contact.name} in ${delaySec} seconds...`);
    const timeoutId = setTimeout(async () => {
        try {
            // 1. Send typing indicator
            await sock.sendPresenceUpdate('composing', remoteJid);
            // 2. Fetch conversation history for GPT context
            const history = await (0, db_js_1.getRecentMessages)(userId, remoteJid, settings.memoryLength);
            // 3. Resolve personality prompt
            const personality = await (0, db_js_1.getPersonalityById)(userId, contact.personalityId);
            const personalityPrompt = personality ? personality.prompt : 'Be a friendly assistant.';
            // 4. Generate response
            const aiReply = await (0, openai_js_1.generateAIResponse)(textContent, history, contact.name, personalityPrompt, settings, imageBase64);
            if (!aiReply) {
                throw new Error('AI returned an empty response');
            }
            // Add a tiny typing indicator presence buffer
            await (0, baileys_1.delay)(2000);
            // 5. Send message
            await sock.sendMessage(remoteJid, { text: aiReply });
            await sock.sendPresenceUpdate('paused', remoteJid);
            // 6. Save reply to history
            await (0, db_js_1.addMessage)(userId, {
                contactId: remoteJid,
                fromMe: true,
                body: aiReply,
                type: 'text',
                aiReplied: true,
            });
            await (0, db_js_1.writeLog)(userId, 'info', `Auto-replied to ${contact.name} via AI.`);
        }
        catch (err) {
            await (0, db_js_1.writeLog)(userId, 'error', `Failed to send AI auto-reply to ${contact.name}`, { error: err.message });
            try {
                await sock.sendPresenceUpdate('paused', remoteJid);
            }
            catch { }
        }
        finally {
            pendingReplies.delete(remoteJid);
        }
    }, delaySec * 1000);
    pendingReplies.set(remoteJid, timeoutId);
}
/**
 * Handle Admin commands sent from the connected device
 */
async function handleAdminCommand(userId, sock, remoteJid, commandText, settings) {
    const parts = commandText.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    await (0, db_js_1.writeLog)(userId, 'info', `Admin command triggered: ${cmd}`);
    let responseText = '';
    switch (cmd) {
        case '/help':
            responseText = `🤖 *WhatsApp AI Assistant Commands*:\n\n` +
                `• \`/status\` - Show connection and config status.\n` +
                `• \`/enable\` - Enable AI replies globally.\n` +
                `• \`/disable\` - Disable AI replies globally.\n` +
                `• \`/restart\` - Re-initialize WhatsApp connection.\n` +
                `• \`/logs\` - View last 5 connection and sync logs.`;
            break;
        case '/status':
            responseText = `🤖 *System Status*:\n\n` +
                `• *Model:* ${settings.openaiModel}\n` +
                `• *Busy Mode:* ${settings.busyMode ? 'ON 🔴' : 'OFF 🟢'}\n` +
                `• *Night Mode:* ${settings.nightMode ? 'ON 🌙' : 'OFF ☀️'}\n` +
                `• *Delay:* ${settings.delayMin}-${settings.delayMax} seconds\n` +
                `• *Client Connection:* Active`;
            break;
        case '/enable':
            await (0, db_js_1.getSettings)(userId); // Ensure document loaded
            await firebase_js_1.db.collection('settings').doc(userId).set({ busyMode: false }, { merge: true });
            responseText = `🟢 AI Auto Reply has been enabled globally.`;
            break;
        case '/disable':
            await firebase_js_1.db.collection('settings').doc(userId).set({ busyMode: true }, { merge: true });
            responseText = `🔴 AI Auto Reply has been disabled globally (Busy mode activated).`;
            break;
        case '/restart':
            responseText = `🔄 Restarting WhatsApp connection socket...`;
            await sock.sendMessage(remoteJid, { text: responseText });
            // Execute reconnect asynchronously
            setTimeout(() => {
                (0, whatsapp_js_1.connectToWhatsApp)(userId);
            }, 1000);
            return;
        case '/logs':
            try {
                const logsSnapshot = await firebase_js_1.db.collection('logs')
                    .where('userId', '==', userId)
                    .orderBy('timestamp', 'desc')
                    .limit(5)
                    .get();
                let logLines = '';
                logsSnapshot.forEach((doc) => {
                    const l = doc.data();
                    const time = l.timestamp ? new Date(l.timestamp.seconds * 1000).toLocaleTimeString() : '';
                    logLines += `[${time}] [${l.level.toUpperCase()}] ${l.message}\n`;
                });
                responseText = `📋 *Recent System Logs*:\n\n${logLines || 'No logs found.'}`;
            }
            catch (err) {
                responseText = `❌ Failed to fetch logs: ${err.message}`;
            }
            break;
        default:
            // Command unrecognized, ignore to avoid interrupting user conversation
            return;
    }
    if (responseText) {
        await sock.sendMessage(remoteJid, { text: responseText });
    }
}
