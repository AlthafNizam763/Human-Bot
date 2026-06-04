import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

/**
 * Fetch dashboard statistical metrics and charts data
 */
export async function handleGetStats(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    // 1. Fetch Contact metrics
    const contactsSnapshot = await db.collection('contacts')
      .where('userId', '==', userId)
      .get();
    
    const totalContacts = contactsSnapshot.size;
    let activeChats = 0;
    
    contactsSnapshot.forEach(doc => {
      if (doc.data().autoReplyEnabled) activeChats++;
    });

    // 2. Fetch overall message counts
    const messagesSnapshot = await db.collection('messages')
      .where('userId', '==', userId)
      .get();
    
    const totalMessages = messagesSnapshot.size;
    let aiReplies = 0;
    
    messagesSnapshot.forEach(doc => {
      if (doc.data().aiReplied) aiReplies++;
    });

    // 3. Generate chart data (last 7 days)
    const chartDataMap = new Map<string, { date: string; messages: number; replies: number }>();
    
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

    const recentMessagesSnapshot = await db.collection('messages')
      .where('userId', '==', userId)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
      .get();

    recentMessagesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp) return;
      
      const date = new Date(data.timestamp.seconds * 1000);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      if (chartDataMap.has(dateStr)) {
        const stats = chartDataMap.get(dateStr)!;
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
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compile statistics.', details: err.message });
  }
}
