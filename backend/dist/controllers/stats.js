"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetStats = handleGetStats;
const firebase_js_1 = require("../config/firebase.js");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
/**
 * Fetch dashboard statistical metrics and charts data
 */
async function handleGetStats(req, res) {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(400).json({ error: 'Missing user context.' });
    }
    try {
        // 1. Fetch Contact metrics
        const contactsSnapshot = await firebase_js_1.db.collection('contacts')
            .where('userId', '==', userId)
            .get();
        const totalContacts = contactsSnapshot.size;
        let activeChats = 0;
        contactsSnapshot.forEach(doc => {
            if (doc.data().autoReplyEnabled)
                activeChats++;
        });
        // 2. Fetch overall message counts
        const messagesSnapshot = await firebase_js_1.db.collection('messages')
            .where('userId', '==', userId)
            .get();
        const totalMessages = messagesSnapshot.size;
        let aiReplies = 0;
        messagesSnapshot.forEach(doc => {
            if (doc.data().aiReplied)
                aiReplies++;
        });
        // 3. Generate chart data (last 7 days)
        const chartDataMap = new Map();
        // Initialize the last 7 days in the map
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            chartDataMap.set(dateStr, { date: dateStr, messages: 0, replies: 0 });
        }
        // Filter and group recent messages
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const recentMessagesSnapshot = await firebase_js_1.db.collection('messages')
            .where('userId', '==', userId)
            .where('timestamp', '>=', firebase_admin_1.default.firestore.Timestamp.fromDate(sevenDaysAgo))
            .get();
        recentMessagesSnapshot.forEach(doc => {
            const data = doc.data();
            if (!data.timestamp)
                return;
            const date = new Date(data.timestamp.seconds * 1000);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (chartDataMap.has(dateStr)) {
                const stats = chartDataMap.get(dateStr);
                stats.messages++;
                if (data.aiReplied) {
                    stats.replies++;
                }
            }
        });
        const chartData = Array.from(chartDataMap.values());
        res.json({
            cards: {
                totalContacts,
                totalMessages,
                aiReplies,
                activeChats
            },
            chartData
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to compile statistics.', details: err.message });
    }
}
