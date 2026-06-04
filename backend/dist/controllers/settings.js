"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetSettings = handleGetSettings;
exports.handleUpdateSettings = handleUpdateSettings;
const db_js_1 = require("../services/db.js");
/**
 * Get settings for the authenticated user
 */
async function handleGetSettings(req, res) {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(400).json({ error: 'Missing user context.' });
    }
    try {
        const settings = await (0, db_js_1.getSettings)(userId);
        // Do not return raw API Key to frontend if already stored, just return boolean indicator
        const sanitizedSettings = {
            ...settings,
            hasApiKey: !!settings.openaiApiKey,
        };
        // Mask key
        if (sanitizedSettings.openaiApiKey) {
            delete sanitizedSettings.openaiApiKey;
        }
        res.json(sanitizedSettings);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve settings.', details: err.message });
    }
}
/**
 * Update user settings
 */
async function handleUpdateSettings(req, res) {
    const userId = req.user?.uid;
    const updates = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'Missing user context.' });
    }
    try {
        // If apiKey is empty and not specified, don't overwrite it. If it is sent as redacted, don't overwrite.
        // If they explicitly pass a new key, save it.
        const cleanUpdates = { ...updates };
        if (cleanUpdates.openaiApiKey === undefined || cleanUpdates.openaiApiKey === '') {
            delete cleanUpdates.openaiApiKey;
        }
        await (0, db_js_1.updateSettings)(userId, cleanUpdates);
        res.json({ success: true, message: 'Settings saved successfully.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to save settings.', details: err.message });
    }
}
