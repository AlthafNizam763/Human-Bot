import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../config/firebase.js';

/**
 * Fetch latest system logs for the user
 */
export async function handleGetLogs(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    const snapshot = await db.collection('logs')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const logs: any[] = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve logs.', details: err.message });
  }
}
