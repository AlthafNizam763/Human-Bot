import { WASocket, proto, downloadMediaMessage, delay } from '@whiskeysockets/baileys';
import pino from 'pino';
import { db } from '../config/firebase.js';
import { getSettings, getOrCreateContact, updateContact, addMessage, getRecentMessages, writeLog, getPersonalityById, getBotStatus } from '../services/db.js';
import { generateAIResponse, transcribeVoiceNote, isSafetyViolation } from '../services/openai.js';
import { connectToWhatsApp, disconnectWhatsApp } from '../services/whatsapp.js';

// In-memory registry to cancel queued replies if the user manually replies
const pendingReplies = new Map<string, NodeJS.Timeout>();

const logger = pino({ level: 'silent' });

/**
 * Main incoming/outgoing WhatsApp message router
 */
export async function handleIncomingMessage(
  userId: string,
  sock: WASocket,
  msg: proto.IWebMessageInfo
) {
  const messageId = msg.key.id;
  const fromMe = msg.key.fromMe;
  const remoteJid = msg.key.remoteJid;

  if (!remoteJid) return;

  // Ignore status broadcasts
  if (remoteJid === 'status@broadcast') return;

  const isGroup = remoteJid.endsWith('@g.us');

  // Load user settings
  const settings = await getSettings(userId);

  // Extract content
  let textContent = '';
  let mediaType: 'text' | 'image' | 'audio' = 'text';
  let imageBase64: string | undefined = undefined;
  let voiceBuffer: Buffer | undefined = undefined;
  let voiceMimeType: string | undefined = undefined;

  const messageType = Object.keys(msg.message || {})[0];

  if (messageType === 'conversation') {
    textContent = msg.message?.conversation || '';
  } else if (messageType === 'extendedTextMessage') {
    textContent = msg.message?.extendedTextMessage?.text || '';
  } else if (messageType === 'imageMessage') {
    mediaType = 'image';
    textContent = msg.message?.imageMessage?.caption || '';
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage }) as Buffer;
      imageBase64 = buffer.toString('base64');
    } catch (err: any) {
      await writeLog(userId, 'error', 'Failed to download image message', { error: err.message });
    }
  } else if (messageType === 'audioMessage') {
    mediaType = 'audio';
    voiceMimeType = msg.message?.audioMessage?.mimetype || 'audio/ogg';
    try {
      voiceBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage }) as Buffer;
    } catch (err: any) {
      await writeLog(userId, 'error', 'Failed to download audio message', { error: err.message });
    }
  } else if (messageType === 'documentMessage') {
    // Ignore documents by default
    return;
  } else {
    // Other message types (reactions, contacts, locations) are ignored or logged
    return;
  }

  // Get sender's name
  const senderName = msg.pushName || remoteJid.split('@')[0];

  // Get or create contact record
  const contact = await getOrCreateContact(userId, remoteJid, senderName);

  // Update contact name if it changed
  if (msg.pushName && contact.name !== msg.pushName) {
    await updateContact(userId, remoteJid, { name: msg.pushName });
  }

  // If message is from me, register the human intervention
  if (fromMe) {
    // Save my message in history
    await addMessage(userId, {
      contactId: remoteJid,
      fromMe: true,
      body: textContent || '[Media/Voice/Image]',
      type: mediaType,
      aiReplied: false,
    });

    // Human intervention check: Cancel any pending auto reply to this contact
    if (pendingReplies.has(remoteJid)) {
      clearTimeout(pendingReplies.get(remoteJid)!);
      pendingReplies.delete(remoteJid);
      await writeLog(userId, 'info', `AI response cancelled. Human intervened in chat with: ${contact.name}`);
    }

    // Process Admin commands sent from my own device/account
    if (textContent.startsWith(settings.openaiApiKey ? '/' : '/')) { // Supports standard slash commands
      await handleAdminCommand(userId, sock, remoteJid, textContent, settings);
    }
    return;
  }

  // Save incoming message in history
  await addMessage(userId, {
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
      await writeLog(userId, 'info', `Transcribing voice note from: ${contact.name}`);
      const transcription = await transcribeVoiceNote(voiceBuffer, voiceMimeType || 'audio/ogg', settings.openaiApiKey);
      await writeLog(userId, 'info', `Transcribed voice note: "${transcription}"`);
      textContent = transcription;
      
      // Save transcribed text inside message history as well
      await addMessage(userId, {
        contactId: remoteJid,
        fromMe: false,
        body: `[Voice Note Transcribed]: ${transcription}`,
        type: 'text',
        aiReplied: false,
      });
    } catch (err: any) {
      await writeLog(userId, 'error', 'Voice note transcription failed', { error: err.message });
      return; // Stop if transcription fails
    }
  }

  // Safety filter check
  if (isSafetyViolation(textContent)) {
    await writeLog(userId, 'warn', `Safety violation detected. Auto reply bypassed for: ${contact.name}`, { message: textContent });
    return;
  }

  // Cancel any existing pending reply to avoid double queues
  if (pendingReplies.has(remoteJid)) {
    clearTimeout(pendingReplies.get(remoteJid)!);
    pendingReplies.delete(remoteJid);
  }

  // Schedule reply execution with random delay
  const delaySec = Math.floor(Math.random() * (settings.delayMax - settings.delayMin + 1)) + settings.delayMin;
  await writeLog(userId, 'info', `Scheduling AI reply to ${contact.name} in ${delaySec} seconds...`);

  const timeoutId = setTimeout(async () => {
    try {
      // 1. Send typing indicator
      await sock.sendPresenceUpdate('composing', remoteJid);

      // 2. Fetch conversation history for GPT context (Load last 50 messages)
      const history = await getRecentMessages(userId, remoteJid, 50);

      // 3. Resolve personality prompt
      const personality = await getPersonalityById(userId, contact.personalityId);
      const personalityPrompt = personality ? personality.prompt : 'Be a friendly assistant.';

      // 4. Load latest bot status dynamically
      const botStatus = await getBotStatus(userId);

      // 5. Generate response
      const aiReply = await generateAIResponse(
        textContent,
        history,
        contact.name,
        personalityPrompt,
        settings,
        botStatus,
        imageBase64
      );

      if (!aiReply) {
        throw new Error('AI returned an empty response');
      }

      // Add a tiny typing indicator presence buffer
      await delay(2000);

      // 5. Send message
      await sock.sendMessage(remoteJid, { text: aiReply });
      await sock.sendPresenceUpdate('paused', remoteJid);

      // 6. Save reply to history
      await addMessage(userId, {
        contactId: remoteJid,
        fromMe: true,
        body: aiReply,
        type: 'text',
        aiReplied: true,
      });

      await writeLog(userId, 'info', `Auto-replied to ${contact.name} via AI.`);
    } catch (err: any) {
      await writeLog(userId, 'error', `Failed to send AI auto-reply to ${contact.name}`, { error: err.message });
      try {
        await sock.sendPresenceUpdate('paused', remoteJid);
      } catch {}
    } finally {
      pendingReplies.delete(remoteJid);
    }
  }, delaySec * 1000);

  pendingReplies.set(remoteJid, timeoutId);
}

/**
 * Handle Admin commands sent from the connected device
 */
async function handleAdminCommand(
  userId: string,
  sock: WASocket,
  remoteJid: string,
  commandText: string,
  settings: any
) {
  const parts = commandText.trim().split(' ');
  const cmd = parts[0].toLowerCase();
  
  await writeLog(userId, 'info', `Admin command triggered: ${cmd}`);

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
      await getSettings(userId); // Ensure document loaded
      await db.collection('settings').doc(userId).set({ busyMode: false }, { merge: true });
      responseText = `🟢 AI Auto Reply has been enabled globally.`;
      break;

    case '/disable':
      await db.collection('settings').doc(userId).set({ busyMode: true }, { merge: true });
      responseText = `🔴 AI Auto Reply has been disabled globally (Busy mode activated).`;
      break;

    case '/restart':
      responseText = `🔄 Restarting WhatsApp connection socket...`;
      await sock.sendMessage(remoteJid, { text: responseText });
      // Execute reconnect asynchronously
      setTimeout(() => {
        connectToWhatsApp(userId);
      }, 1000);
      return;

    case '/logs':
      try {
        const logsSnapshot = await db.collection('logs')
          .where('userId', '==', userId)
          .orderBy('timestamp', 'desc')
          .limit(5)
          .get();
        
        let logLines = '';
        logsSnapshot.forEach((doc: any) => {
          const l = doc.data();
          const time = l.timestamp ? new Date(l.timestamp.seconds * 1000).toLocaleTimeString() : '';
          logLines += `[${time}] [${l.level.toUpperCase()}] ${l.message}\n`;
        });
        responseText = `📋 *Recent System Logs*:\n\n${logLines || 'No logs found.'}`;
      } catch (err: any) {
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
