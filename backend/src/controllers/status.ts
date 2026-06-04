import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getBotStatus, updateBotStatus } from '../services/db.js';

/**
 * Get current bot status configurations
 */
export async function handleGetBotStatus(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    const status = await getBotStatus(userId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve bot status.', details: err.message });
  }
}

/**
 * Update current bot status configurations
 */
export async function handleUpdateBotStatus(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  const { currentStatus, customStatus, busyMode } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    const updates: any = {};
    if (currentStatus !== undefined) updates.currentStatus = currentStatus;
    if (customStatus !== undefined) updates.customStatus = customStatus;
    if (busyMode !== undefined) updates.busyMode = busyMode;

    await updateBotStatus(userId, updates);
    res.json({ success: true, message: 'Bot status updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update bot status.', details: err.message });
  }
}
