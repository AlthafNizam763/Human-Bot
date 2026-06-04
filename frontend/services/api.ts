import { auth } from '@/services/firebase';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

/**
 * Global API Fetch client helper.
 * Automatically injects the Firebase ID Token for Authorization.
 */
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BACKEND_URL}/api${endpoint}`;
  
  // Wait for Firebase to finish loading initial auth state if current user is undefined initially
  // but usually auth triggers once page is loaded.
  const currentUser = auth.currentUser;
  let headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.error('Error fetching Firebase auth token:', err);
    }
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, mergedOptions);

  if (!response.ok) {
    let errMsg = `Request failed with status ${response.status}`;
    try {
      const errBody = await response.json();
      errMsg = errBody.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  return response.json() as Promise<T>;
}

export const apiService = {
  // Connection status
  getConnectionStatus: () => fetchApi<{ status: string; qr: string | null; phone: string | null; error: string | null }>('/whatsapp/status'),
  connectWhatsApp: () => fetchApi<{ success: boolean; message: string }>('/whatsapp/connect', { method: 'POST' }),
  disconnectWhatsApp: () => fetchApi<{ success: boolean; message: string }>('/whatsapp/disconnect', { method: 'POST' }),

  // Contacts
  getContacts: () => fetchApi<any[]>('/contacts'),
  updateContact: (id: string, data: any) => fetchApi<any>(`/contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Personalities
  getPersonalities: () => fetchApi<any[]>('/personalities'),
  createPersonality: (data: any) => fetchApi<any>('/personalities', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updatePersonality: (id: string, data: any) => fetchApi<any>(`/personalities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deletePersonality: (id: string) => fetchApi<any>(`/personalities/${id}`, {
    method: 'DELETE',
  }),

  // Settings
  getSettings: () => fetchApi<any>('/settings'),
  updateSettings: (data: any) => fetchApi<any>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Bot Status
  getBotStatus: () => fetchApi<any>('/bot-status'),
  updateBotStatus: (data: any) => fetchApi<any>('/bot-status', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Logs
  getLogs: () => fetchApi<any[]>('/logs'),

  // Stats
  getStats: () => fetchApi<any>('/stats'),
};
