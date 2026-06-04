"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const whatsapp_js_1 = require("../controllers/whatsapp.js");
const contacts_js_1 = require("../controllers/contacts.js");
const personalities_js_1 = require("../controllers/personalities.js");
const settings_js_1 = require("../controllers/settings.js");
const logs_js_1 = require("../controllers/logs.js");
const stats_js_1 = require("../controllers/stats.js");
const router = (0, express_1.Router)();
// Apply global auth guard to all SaaS dashboard API routes
router.use(auth_js_1.authMiddleware);
// WhatsApp routing
router.get('/whatsapp/status', whatsapp_js_1.handleGetStatus);
router.post('/whatsapp/connect', whatsapp_js_1.handleConnect);
router.post('/whatsapp/disconnect', whatsapp_js_1.handleDisconnect);
router.post('/whatsapp/send', whatsapp_js_1.handleSendMessage);
// Contacts routing
router.get('/contacts', contacts_js_1.handleGetContacts);
router.put('/contacts/:id', contacts_js_1.handleUpdateContact);
// Personalities routing
router.get('/personalities', personalities_js_1.handleGetPersonalities);
router.post('/personalities', personalities_js_1.handleCreatePersonality);
router.put('/personalities/:id', personalities_js_1.handleUpdatePersonality);
router.delete('/personalities/:id', personalities_js_1.handleDeletePersonality);
// Settings routing
router.get('/settings', settings_js_1.handleGetSettings);
router.put('/settings', settings_js_1.handleUpdateSettings);
// Logs routing
router.get('/logs', logs_js_1.handleGetLogs);
// Stats routing
router.get('/stats', stats_js_1.handleGetStats);
exports.default = router;
