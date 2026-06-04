import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config/env.js';
import apiRouter from './routes/index.js';
import { connectToWhatsApp } from './services/whatsapp.js';

const app = express();
const PORT = CONFIG.PORT;

// Standard Middlewares
app.use(cors({
  origin: '*', // Allow dashboard interactions from Vercel / local nextjs
  credentials: true
}));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Register routes
app.use('/api', apiRouter);

// Start listening
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🤖 WhatsApp AI Assistant Server is running on port ${PORT}`);
  console.log(`Node Environment: ${CONFIG.NODE_ENV}`);
  console.log(`===================================================`);

  // Bootstrap previously active WhatsApp sessions
  const sessionDir = CONFIG.WHATSAPP_SESSION_DIR;
  if (fs.existsSync(sessionDir)) {
    try {
      const folders = fs.readdirSync(sessionDir);
      for (const userId of folders) {
        const userPath = path.join(sessionDir, userId);
        if (fs.statSync(userPath).isDirectory()) {
          console.log(`[STARTUP] Reconnecting active session for user: ${userId}`);
          connectToWhatsApp(userId).catch(err => {
            console.error(`[STARTUP] Failed to reconnect user ${userId}:`, err);
          });
        }
      }
    } catch (err) {
      console.error('[STARTUP] Error checking for existing active sessions:', err);
    }
  }
});
