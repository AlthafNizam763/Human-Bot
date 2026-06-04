import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { handleConnect, handleDisconnect, handleGetStatus, handleSendMessage } from '../controllers/whatsapp.js';
import { handleGetContacts, handleUpdateContact } from '../controllers/contacts.js';
import {
  handleGetPersonalities,
  handleCreatePersonality,
  handleUpdatePersonality,
  handleDeletePersonality
} from '../controllers/personalities.js';
import { handleGetSettings, handleUpdateSettings } from '../controllers/settings.js';
import { handleGetLogs } from '../controllers/logs.js';
import { handleGetStats } from '../controllers/stats.js';

const router = Router();

// Apply global auth guard to all SaaS dashboard API routes
router.use(authMiddleware as any);

// WhatsApp routing
router.get('/whatsapp/status', handleGetStatus);
router.post('/whatsapp/connect', handleConnect);
router.post('/whatsapp/disconnect', handleDisconnect);
router.post('/whatsapp/send', handleSendMessage);

// Contacts routing
router.get('/contacts', handleGetContacts);
router.put('/contacts/:id', handleUpdateContact);

// Personalities routing
router.get('/personalities', handleGetPersonalities);
router.post('/personalities', handleCreatePersonality);
router.put('/personalities/:id', handleUpdatePersonality);
router.delete('/personalities/:id', handleDeletePersonality);

// Settings routing
router.get('/settings', handleGetSettings);
router.put('/settings', handleUpdateSettings);

// Logs routing
router.get('/logs', handleGetLogs);

// Stats routing
router.get('/stats', handleGetStats);

export default router;
