import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

/**
 * Get all personality profiles
 */
export async function handleGetPersonalities(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user context.' });
  }

  try {
    const snapshot = await db.collection('personalities')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const personalities: any[] = [];
    
    // Add default 'Friendly' if empty
    if (snapshot.empty) {
      const defaultFriendly = {
        id: 'friendly',
        name: 'Friendly',
        description: 'Casual, friendly, and warm. Good for everyday chats.',
        prompt: 'Act as the account owner. You are friendly, helpful, warm, and highly conversational. Keep replies brief, use emojis occasionally, and speak in a WhatsApp text chat style.',
        createdAt: new Date().toISOString()
      };
      personalities.push(defaultFriendly);
    } else {
      snapshot.forEach(doc => {
        personalities.push({ id: doc.id, ...doc.data() });
      });
      // Ensure friendly is in list if not custom styled
      if (!personalities.some(p => p.id === 'friendly')) {
        personalities.push({
          id: 'friendly',
          name: 'Friendly',
          description: 'Casual, friendly, and warm. Good for everyday chats.',
          prompt: 'Act as the account owner. You are friendly, helpful, warm, and highly conversational. Keep replies brief, use emojis occasionally, and speak in a WhatsApp text chat style.',
          createdAt: new Date().toISOString()
        });
      }
    }

    res.json(personalities);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve personalities.', details: err.message });
  }
}

/**
 * Create a new personality profile
 */
export async function handleCreatePersonality(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  const { name, description, prompt } = req.body;

  if (!userId || !name || !prompt) {
    return res.status(400).json({ error: 'Missing required fields (name, prompt).' });
  }

  try {
    const docRef = db.collection('personalities').doc();
    const newPersonality = {
      userId,
      name,
      description: description || '',
      prompt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await docRef.set(newPersonality);

    res.status(201).json({ id: docRef.id, ...newPersonality });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create personality profile.', details: err.message });
  }
}

/**
 * Update an existing personality profile
 */
export async function handleUpdatePersonality(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  const { id } = req.params;
  const { name, description, prompt } = req.body;

  if (!userId || !id) {
    return res.status(400).json({ error: 'Missing personality ID or user context.' });
  }

  if (id === 'friendly') {
    return res.status(400).json({ error: 'Cannot modify system-default personality.' });
  }

  try {
    const docRef = db.collection('personalities').doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return res.status(404).json({ error: 'Personality profile not found.' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (prompt !== undefined) updates.prompt = prompt;

    await docRef.set(updates, { merge: true });
    
    res.json({ success: true, message: 'Personality updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update personality.', details: err.message });
  }
}

/**
 * Delete a personality profile
 */
export async function handleDeletePersonality(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.uid;
  const { id } = req.params;

  if (!userId || !id) {
    return res.status(400).json({ error: 'Missing personality ID or user context.' });
  }

  if (id === 'friendly') {
    return res.status(400).json({ error: 'Cannot delete system-default personality.' });
  }

  try {
    const docRef = db.collection('personalities').doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return res.status(404).json({ error: 'Personality profile not found.' });
    }

    await docRef.delete();

    // Re-assign default friendly to any contacts using this personality JID
    const contactsSnapshot = await db.collection('contacts')
      .where('userId', '==', userId)
      .where('personalityId', '==', id)
      .get();
      
    const batch = db.batch();
    contactsSnapshot.forEach(doc => {
      batch.update(doc.ref, { personalityId: 'friendly' });
    });
    await batch.commit();

    res.json({ success: true, message: 'Personality deleted and affected contacts updated.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete personality.', details: err.message });
  }
}
