"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_js_1 = require("./config/env.js");
const index_js_1 = __importDefault(require("./routes/index.js"));
const whatsapp_js_1 = require("./services/whatsapp.js");
const app = (0, express_1.default)();
const PORT = env_js_1.CONFIG.PORT;
// Standard Middlewares
app.use((0, cors_1.default)({
    origin: '*', // Allow dashboard interactions from Vercel / local nextjs
    credentials: true
}));
app.use(express_1.default.json());
// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});
// Register routes
app.use('/api', index_js_1.default);
// Start listening
app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🤖 WhatsApp AI Assistant Server is running on port ${PORT}`);
    console.log(`Node Environment: ${env_js_1.CONFIG.NODE_ENV}`);
    console.log(`===================================================`);
    // Bootstrap previously active WhatsApp sessions
    const sessionDir = env_js_1.CONFIG.WHATSAPP_SESSION_DIR;
    if (fs_1.default.existsSync(sessionDir)) {
        try {
            const folders = fs_1.default.readdirSync(sessionDir);
            for (const userId of folders) {
                const userPath = path_1.default.join(sessionDir, userId);
                if (fs_1.default.statSync(userPath).isDirectory()) {
                    console.log(`[STARTUP] Reconnecting active session for user: ${userId}`);
                    (0, whatsapp_js_1.connectToWhatsApp)(userId).catch(err => {
                        console.error(`[STARTUP] Failed to reconnect user ${userId}:`, err);
                    });
                }
            }
        }
        catch (err) {
            console.error('[STARTUP] Error checking for existing active sessions:', err);
        }
    }
});
