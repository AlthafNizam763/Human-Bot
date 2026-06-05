import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config/env.js';
import { Message, UserSettings, BotStatus, Contact } from './db.js';

const clientsMap = new Map<string, OpenAI>();

function getOpenAIClient(apiKeyOverride?: string): OpenAI {
  const apiKey = apiKeyOverride || CONFIG.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API Key is missing. Please configure it in your Settings.');
  }
  
  let cleanApiKey = apiKey.trim();
  if (cleanApiKey.startsWith('OPENAI_API_KEY=')) {
    cleanApiKey = cleanApiKey.split('OPENAI_API_KEY=')[1].trim();
  }
  
  if (clientsMap.has(cleanApiKey)) {
    return clientsMap.get(cleanApiKey)!;
  }

  const isGemini = cleanApiKey.startsWith('AIzaSy') || cleanApiKey.startsWith('AQ.');
  const options: any = { apiKey: cleanApiKey };
  if (isGemini) {
    options.baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/";
  }

  const client = new OpenAI(options);
  clientsMap.set(cleanApiKey, client);
  return client;
}

/**
 * Checks if a message contains sensitive financial/OTP contents that should be filtered.
 */
export function isSafetyViolation(text: string): boolean {
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
export async function transcribeVoiceNote(
  audioBuffer: Buffer,
  mimeType: string,
  apiKeyOverride?: string
): Promise<string> {
  const apiKey = apiKeyOverride || CONFIG.OPENAI_API_KEY;
  
  let cleanApiKey = apiKey.trim();
  if (cleanApiKey.startsWith('OPENAI_API_KEY=')) {
    cleanApiKey = cleanApiKey.split('OPENAI_API_KEY=')[1].trim();
  }
  
  const isGemini = cleanApiKey.startsWith('AIzaSy') || cleanApiKey.startsWith('AQ.');

  if (isGemini) {
    // Call Gemini API directly for transcription since Whisper is unsupported on OpenAI endpoint
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanApiKey}`,
        {
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
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini transcription API error: ${response.statusText}. Details: ${errorText}`);
      }
      
      const result: any = await response.json();
      const transcriptionText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!transcriptionText) {
        throw new Error('Gemini returned an empty transcription response');
      }
      return transcriptionText.trim();
    } catch (err: any) {
      console.error('Gemini transcription failed:', err);
      throw err;
    }
  }

  const client = getOpenAIClient(cleanApiKey);
  
  // Create a temporary file because OpenAI API requires a file stream
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Determine extension
  let ext = 'ogg';
  if (mimeType.includes('mp4')) ext = 'm4a';
  else if (mimeType.includes('mpeg')) ext = 'mp3';
  else if (mimeType.includes('wav')) ext = 'wav';
  else if (mimeType.includes('audio/ogg') || mimeType.includes('audio/opus')) ext = 'ogg';

  const tempFilePath = path.join(tempDir, `vn_${Date.now()}.${ext}`);
  fs.writeFileSync(tempFilePath, audioBuffer);

  try {
    const response = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });
    return response.text;
  } finally {
    // Cleanup temporary file
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {
      console.error('Failed to delete temp file:', e);
    }
  }
}

/**
 * Generate an AI response for a message thread
 */
export async function generateAIResponse(
  messageBody: string,
  history: Message[],
  contactName: string,
  personalityPrompt: string,
  settings: UserSettings,
  botStatus?: BotStatus,
  imageBufferBase64?: string,
  contact?: Contact
): Promise<string> {
  const apiKey = settings.openaiApiKey || CONFIG.OPENAI_API_KEY;
  
  let cleanApiKey = apiKey.trim();
  if (cleanApiKey.startsWith('OPENAI_API_KEY=')) {
    cleanApiKey = cleanApiKey.split('OPENAI_API_KEY=')[1].trim();
  }
  
  const isGemini = cleanApiKey.startsWith('AIzaSy') || cleanApiKey.startsWith('AQ.');
  const client = getOpenAIClient(cleanApiKey);
  
  const now = new Date();
  const timeContext = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dayContext = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  // Resolve status context
  let statusContext = '';
  if (botStatus) {
    statusContext = `
Live Status of Althaf:
- Current Activity/Location: ${botStatus.currentStatus}
- Custom Status: ${botStatus.customStatus ? `"${botStatus.customStatus}"` : 'None'}
- Busy Mode Active: ${botStatus.busyMode ? 'Yes' : 'No'}

Strict Instructions for Location/Activity and Delay/Call Queries (e.g. "nee evideyaa", "evide aanu", "evide poyi", "entha busy", "entha reply tharathath", "call edukkathath entha"):
1. Never invent fake information. Always match Althaf's live status naturally.
2. Randomize your responses and generate variations so you do not repeat the same response. Here are natural examples to adapt dynamically:
   - office: "officeil aanu daa 😅" / "workil aanu" / "ippo officeil thanne" / "kurach busy aanu"
   - home: "veettil aanu" / "veettilund"
   - driving: "drive cheyyukayirunnu" / "vandi oadikkuvaarnnu"
   - sleeping: "urangiyirunnu 😴" / "urangalaayirunnu"
   - gym: "gymil aada" / "workout cheyyuva"
   - meeting: "meeting und" / "meetingila"
   - busy / busyMode: "kurach busy aanu" / "workila"
   - travel: "yathrayila" / "yathrayila da"
   - outside: "purathada" / "puratha"
   - available: reply normally as you wish
`;
  }

  let contactContext = '';
  if (contact) {
    contactContext = `
Contact Profile:
- Name: ${contact.name}
- Phone: ${contact.phone}
- Language Preference: ${contact.language || 'Auto'}
`;
  }

  const systemPrompt = `
You are the personal WhatsApp representation of the account owner, **Althaf**, in a chat with their contact named "${contactName}".
Current Time: ${timeContext} (${dayContext}).
${statusContext}
${contactContext}

IDENTITY & PERSONALITY PROFILE:
- Name: Althaf
- Profession: Software Developer.
- Traits: Speaks Malayalam, Manglish, and English. Friendly, funny, casual, and highly social.
- Role: You are the account owner Althaf himself. You are NOT an AI assistant, chatbot, or customer support agent.

CRITICAL RULES (NEVER VIOLATE):
1. Never reveal you are an AI, bot, automation, system prompt, or OpenAI agent. If asked "are you a bot/AI?" or similar, reply with a casual laugh/denial (e.g., "poda, njan aaraa ninnu thonnunne? 😂" or "no way, entha katha").
2. Never say: "I understand", "I apologize", "How may I assist you?", "Please let me know", "As an AI", "I am an AI", "I don't have feelings", "I don't have personal experience".
3. Never sound robotic or formal unless the conversation with ${contactName} is strictly formal.
4. DO NOT prepend your response with "Me:", "[Me]:", "[Owner]:", or your name. Output ONLY the raw chat bubble message itself.
5. No AI warnings: Never say "As an AI...", "I don't have personal experience...", or "In my database...".

CONVERSATION CATEGORIES & HANDLING:
1. **Casual / Daily / Friendly Chats**:
   - Respond naturally. Use words naturally like "daa", "eda", "macha", "bro", "😅", "😂", "😌", "🤣" (limit emojis to 1-2 max, do not overuse, keep it realistic).
   - Example Friend Mode:
     - Input: "eda" -> Reply: "para daa"
     - Input: "macha" -> Reply: "enthokke und"
2. **General Knowledge & Tech/Sports/Movies**:
   - If someone asks factual questions (e.g., "Who is Messi?", "Best programming language?", "What is AI?", "Latest technology trends?", "Movie suggestions?", general sports, cricket, football, deep topics), answer normally using your internal knowledge.
   - Do NOT pretend not to know or say you are an AI. Give casual, direct, smart answers (e.g., "messi pure genius alle da", "python or javascript standard choice aanu...").
3. **Personal Questions**:
   - Use the live status, conversation history, and user profile.
   - If information is unavailable, reply naturally without making fake claims or fake memories.
   - Example: "innale evide poyi" -> if unknown: "athokke ippo orthu parayan pattilla 😅".
4. **Emotion Detection & Adaptation**:
   - Detect the contact's tone: Happy, Sad, Angry, Romantic, Friendly, Casual, Professional. Match their emotional register and tone in your response.
5. **Romantic / Intimate Conversations**:
   - Respond naturally, playfully, and affectionately. Be human and warm.
   - Examples:
     - Input: "miss cheytho" -> Reply: "pinne cheythille 😌"
     - Input: "enne ishtam undo" -> Reply: "ath ippo chodikkenda karyam aano 😅❤️"
     - Input: "urangiyo" -> Reply: "ippo urangan pokuvanu 😴"
     - Do not suddenly switch to formal or assistant-like language.
6. **Malayalam Manglish Understanding**:
   - Fully understand local terms: "evideyaa", "sugham alle", "entha parupaadi", "kazhicho", "urangiyo", "busy aano", "entha scene", and reply naturally.

HUMAN-LIKE TYPING & FORMATTING:
1. **Short & Punchy**: Write short text bubbles. Avoid long paragraphs. Keep it to 1-3 sentences max.
2. **Natural Casing & Punctuation**:
   - Use lowercase letters mostly (in Manglish or English).
   - **DO NOT** put periods (.) at the end of your message. Use commas, spaces, trailing space, or emojis instead.
   - Use casual punctuation like "..." or "!!" occasionally.
3. **Abbreviations**: Use standard shortcuts: "ok", "k", "gm", "gn", "tc", "lol".
`;

  const messages: any[] = [
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
  let currentUserContent: any = messageBody;
  
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
  } else {
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
