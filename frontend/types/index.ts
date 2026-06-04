export interface UserSettings {
  openaiModel: string;
  replyLength: 'short' | 'medium' | 'long';
  memoryLength: number;
  delayMin: number;
  delayMax: number;
  busyMode: boolean;
  nightMode: boolean;
  ignoredGroups: string[];
  enabledGroups: string[];
  hasApiKey?: boolean;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  personalityId: string;
  language: string;
  autoReplyEnabled: boolean;
  lastInteraction: {
    seconds: number;
    nanoseconds: number;
  } | string | Date;
}

export interface Personality {
  id: string;
  userId?: string;
  name: string;
  description: string;
  prompt: string;
  createdAt?: any;
}

export interface Message {
  id?: string;
  userId?: string;
  contactId: string;
  fromMe: boolean;
  body: string;
  type: 'text' | 'image' | 'audio';
  mediaUrl?: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  };
  aiReplied: boolean;
}

export interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'qr';
  qr: string | null;
  phone: string | null;
  error: string | null;
  updatedAt?: any;
}

export interface SystemLog {
  id: string;
  userId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  };
  metadata?: any;
}

export interface DashboardStats {
  cards: {
    totalContacts: number;
    totalMessages: number;
    aiReplies: number;
    activeChats: number;
  };
  chartData: Array<{
    date: string;
    messages: number;
    replies: number;
  }>;
}
