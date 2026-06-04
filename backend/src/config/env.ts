import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  // Service account can be a file path or a stringified JSON
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  // Session storage path for Baileys
  WHATSAPP_SESSION_DIR: process.env.WHATSAPP_SESSION_DIR || path.join(process.cwd(), 'whatsapp-session'),
  // Secret command prefix
  ADMIN_COMMAND_PREFIX: '/',
};
