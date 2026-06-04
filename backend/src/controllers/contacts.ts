import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../config/firebase.js';

/**
 * List all contacts for the authenticated user
 */
export async function handleGetContacts(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    const snapshot = await db.collection('contacts')
      .where('userId', '==', userId)
      .orderBy('lastInteraction', 'desc')
      .get();

    const contacts: any[] = [];
    snapshot.forEach(doc => {
      contacts.push({ id: doc.id, ...doc.data() });
    });

    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve contacts.', details: err.message });
  }
}

/**
 * Update contact configuration
 */
export async function handleUpdateContact(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  const { id } = req.params;
  const { autoReplyEnabled, personalityId, language, name } = req.body;

  if (!userId || !id) {
    return res.status(400).json({ error: 'Missing contact ID or user context.' });
  }

  try {
    const docRef = db.collection('contacts').doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return res.status(404).json({ error: 'Contact not found.' });
    }

    const updates: any = {};
    if (autoReplyEnabled !== undefined) updates.autoReplyEnabled = autoReplyEnabled;
    if (personalityId !== undefined) updates.personalityId = personalityId;
    if (language !== undefined) updates.language = language;
    if (name !== undefined) updates.name = name;

    await docRef.set(updates, { merge: true });
    
    res.json({ success: true, message: 'Contact updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update contact.', details: err.message });
  }
}
