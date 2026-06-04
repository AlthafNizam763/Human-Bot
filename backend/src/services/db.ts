import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

// Default global settings structure
export interface UserSettings {
  openaiApiKey?: string;
  openaiModel: string;
  replyLength: 'short' | 'medium' | 'long';
  memoryLength: number;
  delayMin: number;
  delayMax: number;
  busyMode: boolean;
  nightMode: boolean;
  ignoredGroups: string[];
  enabledGroups: string[];
}

export const DEFAULT_SETTINGS: UserSettings = {
  openaiModel: 'gpt-4o-mini',
  replyLength: 'medium',
  memoryLength: 10,
  delayMin: 3,
  delayMax: 15,
  busyMode: false,
  nightMode: false,
  ignoredGroups: [],
  enabledGroups: [],
};

// Types
export interface Contact {
  id?: string;
  userId: string;
  name: string;
  phone: string;
  personalityId: string; // Refers to a Personality profile
  language: string; // 'Malayalam' | 'Manglish' | 'English' | 'Auto'
  autoReplyEnabled: boolean;
  lastInteraction: admin.firestore.Timestamp;
}

export interface Personality {
  id?: string;
  userId: string;
  name: string;
  description: string;
  prompt: string;
  createdAt: admin.firestore.Timestamp;
}

export interface Message {
  id?: string;
  userId: string;
  contactId: string; // The contact ID (phone number or doc id)
  fromMe: boolean;
  body: string;
  type: 'text' | 'image' | 'audio';
  mediaUrl?: string;
  timestamp: admin.firestore.Timestamp;
  aiReplied: boolean;
}

export interface Log {
  id?: string;
  userId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: admin.firestore.Timestamp;
  metadata?: any;
}

/**
 * Settings helpers
 */
export async function getSettings(userId: string): Promise<UserSettings> {
  const docRef = db.collection('settings').doc(userId);
  const doc = await docRef.get();
  if (!doc.exists) {
    // Write defaults if not exist
    await docRef.set(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...doc.data() } as UserSettings;
}

export async function updateSettings(userId: string, data: Partial<UserSettings>): Promise<void> {
  const docRef = db.collection('settings').doc(userId);
  await docRef.set(data, { merge: true });
}

/**
 * Contact helpers
 */
export async function getContact(userId: string, phone: string): Promise<Contact | null> {
  const snapshot = await db.collection('contacts')
    .where('userId', '==', userId)
    .where('phone', '==', phone)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Contact;
}

export async function createContact(userId: string, contactData: Omit<Contact, 'userId' | 'lastInteraction'>): Promise<Contact> {
  const docRef = db.collection('contacts').doc();
  const newContact: Contact = {
    ...contactData,
    userId,
    lastInteraction: admin.firestore.Timestamp.now(),
  };
  await docRef.set(newContact);
  return { id: docRef.id, ...newContact };
}

export async function getOrCreateContact(userId: string, phone: string, name: string): Promise<Contact> {
  const contact = await getContact(userId, phone);
  if (contact) return contact;

  // Find default personality to assign if none
  const defaultPersonality = await getDefaultPersonality(userId);
  
  return await createContact(userId, {
    name: name || phone.split('@')[0],
    phone,
    personalityId: defaultPersonality ? defaultPersonality.id || 'friendly' : 'friendly',
    language: 'Auto',
    autoReplyEnabled: true,
  });
}

export async function updateContact(userId: string, phone: string, data: Partial<Contact>): Promise<void> {
  const contact = await getContact(userId, phone);
  if (!contact || !contact.id) return;
  await db.collection('contacts').doc(contact.id).set({
    ...data,
    lastInteraction: admin.firestore.Timestamp.now()
  }, { merge: true });
}

/**
 * Personality helpers
 */
export async function getDefaultPersonality(userId: string): Promise<Personality | null> {
  const snapshot = await db.collection('personalities')
    .where('userId', '==', userId)
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    // Seed standard Friendly personality if it doesn't exist
    const docRef = db.collection('personalities').doc();
    const friendly: Personality = {
      userId,
      name: 'Friendly',
      description: 'Casual, friendly, and helpful. Replies with emojis and matches the sender tone.',
      prompt: 'Act as the account owner. You are friendly, helpful, warm, and highly conversational. Reply in the same language as the user (Malayalam/Manglish/English). Keep replies brief and in a natural WhatsApp chat format.',
      createdAt: admin.firestore.Timestamp.now(),
    };
    await docRef.set(friendly);
    return { id: docRef.id, ...friendly };
  }
  
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Personality;
}

export async function getPersonalityById(userId: string, personalityId: string): Promise<Personality | null> {
  // Check default keywords
  if (personalityId === 'friendly') {
    return {
      id: 'friendly',
      userId,
      name: 'Friendly',
      description: 'Casual and warm.',
      prompt: 'Act as the account owner. You are friendly, helpful, warm, and highly conversational. Keep replies brief, use emojis occasionally, and speak in a WhatsApp text chat style.',
      createdAt: admin.firestore.Timestamp.now()
    };
  }

  const doc = await db.collection('personalities').doc(personalityId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() } as Personality;
}

/**
 * Message logging helpers
 */
export async function addMessage(userId: string, msg: Omit<Message, 'userId' | 'timestamp'>): Promise<void> {
  const docRef = db.collection('messages').doc();
  await docRef.set({
    ...msg,
    userId,
    timestamp: admin.firestore.Timestamp.now(),
  });
}

export async function getRecentMessages(userId: string, contactId: string, limit: number = 10): Promise<Message[]> {
  const snapshot = await db.collection('messages')
    .where('userId', '==', userId)
    .where('contactId', '==', contactId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  const messages: Message[] = [];
  snapshot.forEach(doc => {
    messages.push({ id: doc.id, ...doc.data() } as Message);
  });
  // Return in chronological order
  return messages.reverse();
}

/**
 * System Logs helper
 */
export async function writeLog(userId: string, level: 'info' | 'warn' | 'error', message: string, metadata?: any): Promise<void> {
  const docRef = db.collection('logs').doc();
  await docRef.set({
    userId,
    level,
    message,
    metadata: metadata || null,
    timestamp: admin.firestore.Timestamp.now()
  });
  console.log(`[LOG - ${level.toUpperCase()}] ${message}`, metadata ? JSON.stringify(metadata) : '');
}
