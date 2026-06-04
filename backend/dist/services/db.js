"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = void 0;
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.getContact = getContact;
exports.createContact = createContact;
exports.getOrCreateContact = getOrCreateContact;
exports.updateContact = updateContact;
exports.getDefaultPersonality = getDefaultPersonality;
exports.getPersonalityById = getPersonalityById;
exports.addMessage = addMessage;
exports.getRecentMessages = getRecentMessages;
exports.writeLog = writeLog;
const firebase_js_1 = require("../config/firebase.js");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.DEFAULT_SETTINGS = {
    openaiModel: 'gpt-4o-mini',
    replyLength: 'medium',
    memoryLength: 10,
    delayMin: 3,
    delayMax: 15,
    busyMode: false,
    nightMode: false,
    ignoredGroups: [],
    enabledGroups: [],
};
/**
 * Settings helpers
 */
async function getSettings(userId) {
    const docRef = firebase_js_1.db.collection('settings').doc(userId);
    const doc = await docRef.get();
    if (!doc.exists) {
        // Write defaults if not exist
        await docRef.set(exports.DEFAULT_SETTINGS);
        return exports.DEFAULT_SETTINGS;
    }
    return { ...exports.DEFAULT_SETTINGS, ...doc.data() };
}
async function updateSettings(userId, data) {
    const docRef = firebase_js_1.db.collection('settings').doc(userId);
    await docRef.set(data, { merge: true });
}
/**
 * Contact helpers
 */
async function getContact(userId, phone) {
    const snapshot = await firebase_js_1.db.collection('contacts')
        .where('userId', '==', userId)
        .where('phone', '==', phone)
        .limit(1)
        .get();
    if (snapshot.empty)
        return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}
async function createContact(userId, contactData) {
    const docRef = firebase_js_1.db.collection('contacts').doc();
    const newContact = {
        ...contactData,
        userId,
        lastInteraction: firebase_admin_1.default.firestore.Timestamp.now(),
    };
    await docRef.set(newContact);
    return { id: docRef.id, ...newContact };
}
async function getOrCreateContact(userId, phone, name) {
    const contact = await getContact(userId, phone);
    if (contact)
        return contact;
    // Find default personality to assign if none
    const defaultPersonality = await getDefaultPersonality(userId);
    return await createContact(userId, {
        name: name || phone.split('@')[0],
        phone,
        personalityId: defaultPersonality ? defaultPersonality.id || 'friendly' : 'friendly',
        language: 'Auto',
        autoReplyEnabled: true,
    });
}
async function updateContact(userId, phone, data) {
    const contact = await getContact(userId, phone);
    if (!contact || !contact.id)
        return;
    await firebase_js_1.db.collection('contacts').doc(contact.id).set({
        ...data,
        lastInteraction: firebase_admin_1.default.firestore.Timestamp.now()
    }, { merge: true });
}
/**
 * Personality helpers
 */
async function getDefaultPersonality(userId) {
    const snapshot = await firebase_js_1.db.collection('personalities')
        .where('userId', '==', userId)
        .limit(1)
        .get();
    if (snapshot.empty) {
        // Seed standard Friendly personality if it doesn't exist
        const docRef = firebase_js_1.db.collection('personalities').doc();
        const friendly = {
            userId,
            name: 'Friendly',
            description: 'Casual, friendly, and helpful. Replies with emojis and matches the sender tone.',
            prompt: 'Act as the account owner. You are friendly, helpful, warm, and highly conversational. Reply in the same language as the user (Malayalam/Manglish/English). Keep replies brief and in a natural WhatsApp chat format.',
            createdAt: firebase_admin_1.default.firestore.Timestamp.now(),
        };
        await docRef.set(friendly);
        return { id: docRef.id, ...friendly };
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}
async function getPersonalityById(userId, personalityId) {
    // Check default keywords
    if (personalityId === 'friendly') {
        return {
            id: 'friendly',
            userId,
            name: 'Friendly',
            description: 'Casual and warm.',
            prompt: 'Act as the account owner. You are friendly, helpful, warm, and highly conversational. Keep replies brief, use emojis occasionally, and speak in a WhatsApp text chat style.',
            createdAt: firebase_admin_1.default.firestore.Timestamp.now()
        };
    }
    const doc = await firebase_js_1.db.collection('personalities').doc(personalityId).get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() };
}
/**
 * Message logging helpers
 */
async function addMessage(userId, msg) {
    const docRef = firebase_js_1.db.collection('messages').doc();
    await docRef.set({
        ...msg,
        userId,
        timestamp: firebase_admin_1.default.firestore.Timestamp.now(),
    });
}
async function getRecentMessages(userId, contactId, limit = 10) {
    const snapshot = await firebase_js_1.db.collection('messages')
        .where('userId', '==', userId)
        .where('contactId', '==', contactId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
    const messages = [];
    snapshot.forEach(doc => {
        messages.push({ id: doc.id, ...doc.data() });
    });
    // Return in chronological order
    return messages.reverse();
}
/**
 * System Logs helper
 */
async function writeLog(userId, level, message, metadata) {
    const docRef = firebase_js_1.db.collection('logs').doc();
    await docRef.set({
        userId,
        level,
        message,
        metadata: metadata || null,
        timestamp: firebase_admin_1.default.firestore.Timestamp.now()
    });
    console.log(`[LOG - ${level.toUpperCase()}] ${message}`, metadata ? JSON.stringify(metadata) : '');
}
