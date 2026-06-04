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
let openaiClient = null;
function getOpenAIClient(apiKeyOverride) {
    const apiKey = apiKeyOverride || env_js_1.CONFIG.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API Key is missing. Please configure it in your Settings.');
    }
    if (!openaiClient || (apiKeyOverride && openaiClient.apiKey !== apiKeyOverride)) {
        openaiClient = new openai_1.OpenAI({ apiKey });
    }
    return openaiClient;
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
    const client = getOpenAIClient(apiKeyOverride);
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
    const client = getOpenAIClient(settings.openaiApiKey);
    const systemPrompt = `
You are the personal WhatsApp AI Assistant acting as the account owner in their chat.
Follow these strict rules:
1. **Never reveal you are an AI or an automated system**. You are the owner of this WhatsApp account.
2. Reply naturally, in a casual, conversational WhatsApp text messaging style.
3. Keep replies relative to the length setting: ${settings.replyLength}.
4. You must understand and communicate in: **Malayalam, Manglish (Malayalam in English script like "evideyaa", "enthayi", "sughamaano"), and English**.
5. **CRITICAL: Detect and reply in the same language and script that the sender is using**. If they use Manglish, reply in Manglish. If they use Malayalam script, reply in Malayalam script. If they use English, reply in English.
6. Match the emotional tone of the sender (e.g. friendly, professional, happy, sad, angry).
7. Match the personality requested for this chat:
"${personalityPrompt}"
8. Keep replies concise, human-like, and formatting friendly (use casual punctuation, lowercase when natural, and optional emojis). Avoid perfect essay formats. Use abbreviations when appropriate (like "tc", "gm", "poda", "enth").
`;
    const messages = [
        { role: 'system', content: systemPrompt }
    ];
    // Add conversation history for context
    // Filter history to fit within memoryLength limit
    const recentHistory = history.slice(-settings.memoryLength);
    recentHistory.forEach(msg => {
        messages.push({
            role: msg.fromMe ? 'assistant' : 'user',
            content: msg.body
        });
    });
    // Prepare current user message
    let currentUserContent = messageBody;
    if (imageBufferBase64) {
        currentUserContent = [
            { type: 'text', text: messageBody || "Describe this image and reply contextually." },
            {
                type: 'image_url',
                image_url: {
                    url: `data:image/jpeg;base64,${imageBufferBase64}`
                }
            }
        ];
    }
    messages.push({
        role: 'user',
        content: currentUserContent
    });
    const response = await client.chat.completions.create({
        model: settings.openaiModel || 'gpt-4o-mini',
        messages: messages,
        max_tokens: settings.replyLength === 'short' ? 60 : settings.replyLength === 'medium' ? 150 : 350,
        temperature: 0.8
    });
    return response.choices[0]?.message?.content || "";
}
