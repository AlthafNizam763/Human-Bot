"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSafetyViolation = isSafetyViolation;
exports.transcribeVoiceNote = transcribeVoiceNote;
exports.generateAIResponse = generateAIResponse;
const openai_1 = require("openai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_js_1 = require("../config/env.js");
const clientsMap = new Map();
function getOpenAIClient(apiKeyOverride) {
    const apiKey = apiKeyOverride || env_js_1.CONFIG.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API Key is missing. Please configure it in your Settings.');
    }
    let cleanApiKey = apiKey.trim();
    if (cleanApiKey.startsWith('OPENAI_API_KEY=')) {
        cleanApiKey = cleanApiKey.split('OPENAI_API_KEY=')[1].trim();
    }
    if (clientsMap.has(cleanApiKey)) {
        return clientsMap.get(cleanApiKey);
    }
    const isGemini = cleanApiKey.startsWith('AIzaSy') || cleanApiKey.startsWith('AQ.');
    const options = { apiKey: cleanApiKey };
    if (isGemini) {
        options.baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/";
    }
    const client = new openai_1.OpenAI(options);
    clientsMap.set(cleanApiKey, client);
    return client;
}
/**
 * Checks if a message contains sensitive financial/OTP contents that should be filtered.
 */
function isSafetyViolation(text) {
    const normalized = text.toLowerCase();
    // OTP and Verification codes pattern
    const otpKeywords = [
        'otp', 'verification code', 'verify your account', 'one-time password',
        'security code', 'activation code', 'mfa code', '2fa code'
    ];
    // Banking and Payments alerts
    const bankKeywords = [
        'debited', 'credited', 'bank account', 'transaction alert', 'payment received',
        'sent you rs', 'received rs', 'insufficient balance', 'card blocked',
        'withdrawn', 'remittance', 'credit card payment due'
    ];
    const hasOtp = otpKeywords.some(keyword => normalized.includes(keyword));
    const hasBank = bankKeywords.some(keyword => normalized.includes(keyword));
    // Match numeric patterns often associated with bank OTPs or transaction alerts
    const matchesOtpPattern = /\b\d{4,8}\b/.test(text) && (normalized.includes('code') || normalized.includes('pin') || normalized.includes('otp'));
    return hasOtp || hasBank || matchesOtpPattern;
}
/**
 * Transcribe a WhatsApp audio voice note using OpenAI Whisper
 */
async function transcribeVoiceNote(audioBuffer, mimeType, apiKeyOverride) {
    const apiKey = apiKeyOverride || env_js_1.CONFIG.OPENAI_API_KEY;
    let cleanApiKey = apiKey.trim();
    if (cleanApiKey.startsWith('OPENAI_API_KEY=')) {
        cleanApiKey = cleanApiKey.split('OPENAI_API_KEY=')[1].trim();
    }
    const isGemini = cleanApiKey.startsWith('AIzaSy') || cleanApiKey.startsWith('AQ.');
    if (isGemini) {
        // Call Gemini API directly for transcription since Whisper is unsupported on OpenAI endpoint
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: mimeType === 'audio/ogg' || mimeType.includes('opus') ? 'audio/ogg' : mimeType,
                                        data: audioBuffer.toString('base64')
                                    }
                                },
                                {
                                    text: "Transcribe this audio file into text. If it is in Malayalam or Manglish, transcribe it accordingly in the language spoken. Output only the transcription, nothing else."
                                }
                            ]
                        }]
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini transcription API error: ${response.statusText}. Details: ${errorText}`);
            }
            const result = await response.json();
            const transcriptionText = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!transcriptionText) {
                throw new Error('Gemini returned an empty transcription response');
            }
            return transcriptionText.trim();
        }
        catch (err) {
            console.error('Gemini transcription failed:', err);
            throw err;
        }
    }
    const client = getOpenAIClient(cleanApiKey);
    // Create a temporary file because OpenAI API requires a file stream
    const tempDir = path_1.default.join(process.cwd(), 'temp');
    if (!fs_1.default.existsSync(tempDir)) {
        fs_1.default.mkdirSync(tempDir, { recursive: true });
    }
    // Determine extension
    let ext = 'ogg';
    if (mimeType.includes('mp4'))
        ext = 'm4a';
    else if (mimeType.includes('mpeg'))
        ext = 'mp3';
    else if (mimeType.includes('wav'))
        ext = 'wav';
    else if (mimeType.includes('audio/ogg') || mimeType.includes('audio/opus'))
        ext = 'ogg';
    const tempFilePath = path_1.default.join(tempDir, `vn_${Date.now()}.${ext}`);
    fs_1.default.writeFileSync(tempFilePath, audioBuffer);
    try {
        const response = await client.audio.transcriptions.create({
            file: fs_1.default.createReadStream(tempFilePath),
            model: 'whisper-1',
        });
        return response.text;
    }
    finally {
        // Cleanup temporary file
        try {
            if (fs_1.default.existsSync(tempFilePath)) {
                fs_1.default.unlinkSync(tempFilePath);
            }
        }
        catch (e) {
            console.error('Failed to delete temp file:', e);
        }
    }
}
/**
 * Generate an AI response for a message thread
 */
async function generateAIResponse(messageBody, history, contactName, personalityPrompt, settings, imageBufferBase64) {
    const apiKey = settings.openaiApiKey || env_js_1.CONFIG.OPENAI_API_KEY;
    let cleanApiKey = apiKey.trim();
    if (cleanApiKey.startsWith('OPENAI_API_KEY=')) {
        cleanApiKey = cleanApiKey.split('OPENAI_API_KEY=')[1].trim();
    }
    const isGemini = cleanApiKey.startsWith('AIzaSy') || cleanApiKey.startsWith('AQ.');
    const client = getOpenAIClient(cleanApiKey);
    const now = new Date();
    const timeContext = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dayContext = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    const systemPrompt = `
You are the personal WhatsApp AI Assistant representing the account owner in a chat with their contact named "${contactName}".
Current Time: ${timeContext} (${dayContext}).

CRITICAL IDENTITY RULES:
1. **Never reveal you are an AI, bot, or assistant**. Speak as the owner of this WhatsApp account. If asked "are you a bot?" or similar, reply with a casual laugh/denial (e.g., "poda, njan aaraa ninnu thonnunne? 😂" or "no way, entha katha").
2. Match the requested personality profile:
"${personalityPrompt}"
3. **DO NOT prepend your response with "Me:", "[Me]:", "[Owner]:", or your name**. Output ONLY the raw chat bubble message itself.

TRILINGUAL CHAT PROTOCOLS (Malayalam, Manglish, English):
1. **Script & Language Matching**: Reply in the EXACT same language and script (Malayalam script vs Latin/Manglish script vs English) that "${contactName}" is using.
2. **Colloquial Manglish Rules**:
   - Spelled phonetically: Use "sugam", "evda", "enthayi", "da", "shery", "potte", "poda", "mone", "machane", "sathyam", "njn" (for njan), "nee", "nna", "enth", "nokkam", "ind" (for und), "ila" (for illa).
   - Avoid textbook spellings like "sughamaano" or "evideya". Keep it relaxed and phonetic, exactly like standard Kerala youth chats.
3. **Colloquial Malayalam Rules**:
   - Use natural local slang (e.g. "എന്താടാ", "സുഖം തന്നേ", "ശരി", "പിന്നെ കാണാം").

HUMAN-LIKE TYPING & FORMATTING:
1. **Short & Punchy**: Keralites write short WhatsApp text bubbles. Avoid long paragraphs. Keep it to 1-3 sentences max.
2. **Natural Casing & Punctuation**:
   - Use lowercase letters mostly (in Manglish or English).
   - **DO NOT** put periods (.) at the end of your message. It looks cold and robotic. Use commas, spaces, or emojis instead.
   - Use casual punctuation like "..." or "!!" occasionally.
3. **Emoji Control**: Limit emojis to 0, 1, or 2 max. Do not spam them.
4. **Abbreviations**: Use standard shortcuts: "ok", "k", "gm", "gn", "tc", "lol".
`;
    const messages = [
        { role: 'system', content: systemPrompt }
    ];
    // Add conversation history for context
    // Filter history to fit within memoryLength limit
    const recentHistory = history.slice(-settings.memoryLength);
    recentHistory.forEach(msg => {
        const sender = msg.fromMe ? 'Me' : contactName;
        messages.push({
            role: msg.fromMe ? 'assistant' : 'user',
            content: `[${sender}]: ${msg.body}`
        });
    });
    // Prepare current user message
    let currentUserContent = messageBody;
    if (imageBufferBase64) {
        currentUserContent = [
            { type: 'text', text: `[${contactName}]: ${messageBody || "Describe this image and reply contextually."}` },
            {
                type: 'image_url',
                image_url: {
                    url: `data:image/jpeg;base64,${imageBufferBase64}`
                }
            }
        ];
    }
    else {
        currentUserContent = `[${contactName}]: ${messageBody}`;
    }
    messages.push({
        role: 'user',
        content: currentUserContent
    });
    let model = settings.openaiModel || 'gpt-4o-mini';
    if (isGemini) {
        model = model.startsWith('gpt-4o-mini') ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
    }
    const response = await client.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: settings.replyLength === 'short' ? 60 : settings.replyLength === 'medium' ? 150 : 350,
        temperature: 0.85
    });
    const aiReply = response.choices[0]?.message?.content || "";
    // Clean reply from formatting tags if the LLM accidentally included them
    let cleanReply = aiReply.trim();
    cleanReply = cleanReply.replace(/^\[?Me\]?:\s*/i, '');
    cleanReply = cleanReply.replace(/^\[?Owner\]?:\s*/i, '');
    cleanReply = cleanReply.replace(/^\[?Assistant\]?:\s*/i, '');
    cleanReply = cleanReply.replace(/^\[?System\]?:\s*/i, '');
    return cleanReply;
}
