'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/services/firebase';
import { apiService } from '@/services/api';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, User, Bot, Search, PhoneCall, Radio, CheckCheck, RefreshCw } from 'lucide-react';
import { Contact, Message } from '@/types/index';
import { useToast } from '@/hooks/useToast';

export default function ConversationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  
  const [search, setSearch] = useState('');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 1. Real-time Listeners for Contacts
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'contacts'),
      where('userId', '==', user.uid),
      orderBy('lastInteraction', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Contact[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Contact);
      });
      setContacts(list);
    }, (err) => {
      console.error('Firestore contacts snapshot error:', err);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Real-time Listeners for Active Contact Messages
  useEffect(() => {
    if (!user || !activeContact) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('userId', '==', user.uid),
      where('contactId', '==', activeContact.phone),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(list);
    }, (err) => {
      console.error('Firestore messages snapshot error:', err);
    });

    return () => unsubscribe();
  }, [user, activeContact]);

  // Handle manual reply submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeContact || !user) return;

    setSending(true);
    const textToSend = inputText;
    setInputText('');

    try {
      // Execute post fetch using backend endpoint.
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      const token = await user.getIdToken();

      const response = await fetch(`${BACKEND_URL}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jid: activeContact.phone,
          text: textToSend
        })
      });

      if (!response.ok) {
        throw new Error('Failed to dispatch manual message.');
      }

      toast('Message dispatched manually.', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to dispatch manual message.', 'error');
      // Restore input text on failure
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  // Filter contacts
  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="absolute inset-0 flex p-6 gap-6 h-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Left Contacts Sidebar */}
      <div className="w-80 flex flex-col bg-card/45 border border-border/50 rounded-lg overflow-hidden h-full">
        {/* Search */}
        <div className="p-4 border-b border-border/50 bg-card/20">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chat history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Contacts list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/25">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground">
              No threads found.
            </div>
          ) : (
            filteredContacts.map((c) => {
              const isSelected = activeContact?.id === c.id;
              
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveContact(c)}
                  className={`flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-primary/10 border-l-4 border-primary text-foreground' 
                      : 'hover:bg-accent/10 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs border ${
                    isSelected ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border'
                  }`}>
                    {c.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold truncate text-foreground">{c.name}</p>
                      {c.autoReplyEnabled && (
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
                      )}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                      {c.phone.split('@')[0]}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Chat window */}
      <div className="flex-1 flex flex-col bg-card/45 border border-border/50 rounded-lg overflow-hidden h-full">
        {activeContact ? (
          <>
            {/* Header info */}
            <div className="h-16 border-b border-border/50 bg-card/20 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center text-xs font-bold">
                  {activeContact.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{activeContact.name}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{activeContact.phone}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {activeContact.autoReplyEnabled ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                    AI Replier Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full font-medium">
                    Manual Only
                  </span>
                )}
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/10">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Empty conversation log. Send a message to start syncing history.
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isMe = m.fromMe;
                  const time = m.timestamp 
                    ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={m.id || idx}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 shadow-sm border ${
                          isMe
                            ? 'bg-primary text-primary-foreground border-primary/10 rounded-tr-none'
                            : 'bg-card text-card-foreground border-border/50 rounded-tl-none'
                        }`}
                      >
                        {/* Header badge if AI Replied */}
                        {m.aiReplied && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold mb-1 uppercase tracking-wide">
                            <Bot className="w-3 h-3" />
                            AI Response
                          </span>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                        
                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-75 select-none">
                          <span>{time}</span>
                          {isMe && <CheckCheck className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-border/50 bg-card/20 flex gap-2 shrink-0">
              <Input
                placeholder="Type a manual reply to hijack AI queue..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={sending}
                className="flex-1"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={sending || !inputText.trim()}
                className="cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Bot className="w-12 h-12 text-primary animate-pulse mb-3" />
            <h3 className="font-bold text-foreground">Select a Conversation</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Click a contact from the left list to review real-time messages and manual override controls
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
