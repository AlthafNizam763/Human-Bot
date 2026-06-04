"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetContacts = handleGetContacts;
exports.handleUpdateContact = handleUpdateContact;
const firebase_js_1 = require("../config/firebase.js");
/**
 * List all contacts for the authenticated user
 */
async function handleGetContacts(req, res) {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(400).json({ error: 'Missing user context.' });
    }
    try {
        const snapshot = await firebase_js_1.db.collection('contacts')
            .where('userId', '==', userId)
            .orderBy('lastInteraction', 'desc')
            .get();
        const contacts = [];
        snapshot.forEach(doc => {
            contacts.push({ id: doc.id, ...doc.data() });
        });
        res.json(contacts);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve contacts.', details: err.message });
    }
}
/**
 * Update contact configuration
 */
async function handleUpdateContact(req, res) {
    const userId = req.user?.uid;
    const { id } = req.params;
    const { autoReplyEnabled, personalityId, language, name } = req.body;
    if (!userId || !id) {
        return res.status(400).json({ error: 'Missing contact ID or user context.' });
    }
    try {
        const docRef = firebase_js_1.db.collection('contacts').doc(id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data()?.userId !== userId) {
            return res.status(404).json({ error: 'Contact not found.' });
        }
        const updates = {};
        if (autoReplyEnabled !== undefined)
            updates.autoReplyEnabled = autoReplyEnabled;
        if (personalityId !== undefined)
            updates.personalityId = personalityId;
        if (language !== undefined)
            updates.language = language;
        if (name !== undefined)
            updates.name = name;
        await docRef.set(updates, { merge: true });
        res.json({ success: true, message: 'Contact updated successfully.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update contact.', details: err.message });
    }
}
