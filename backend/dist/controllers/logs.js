"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetLogs = handleGetLogs;
const firebase_js_1 = require("../config/firebase.js");
/**
 * Fetch latest system logs for the user
 */
async function handleGetLogs(req, res) {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(400).json({ error: 'Missing user context.' });
    }
    try {
        const snapshot = await firebase_js_1.db.collection('logs')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
        const logs = [];
        snapshot.forEach(doc => {
            logs.push({ id: doc.id, ...doc.data() });
        });
        res.json(logs);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve logs.', details: err.message });
    }
}
