import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getSettings, updateSettings } from '../services/db.js';

/**
 * Get settings for the authenticated user
 */
export async function handleGetSettings(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    const settings = await getSettings(userId);
    
    // Do not return raw API Key to frontend if already stored, just return boolean indicator
    const sanitizedSettings = {
      ...settings,
      hasApiKey: !!settings.openaiApiKey,
    };
    
    // Mask key
    if (sanitizedSettings.openaiApiKey) {
      delete (sanitizedSettings as any).openaiApiKey;
    }
    
    res.json(sanitizedSettings);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve settings.', details: err.message });
  }
}

/**
 * Update user settings
 */
export async function handleUpdateSettings(req: AuthenticatedRequest, res: Response) {
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

    await updateSettings(userId, cleanUpdates);
    
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save settings.', details: err.message });
  }
}
