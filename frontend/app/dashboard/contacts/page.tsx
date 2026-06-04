'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog } from '@/components/ui/dialog';
import { Search, UserCog, ToggleLeft, ToggleRight, Settings2, RefreshCw } from 'lucide-react';
import { Contact, Personality } from '@/types/index';

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Edit fields
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [personalityId, setPersonalityId] = useState('friendly');
  const [language, setLanguage] = useState('Auto');
  const [contactName, setContactName] = useState('');

  // Fetch Contacts
  const { data: contacts = [], isLoading: contactsLoading, refetch: refetchContacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: apiService.getContacts,
  });

  // Fetch Personalities (to display in dropdown selection)
  const { data: personalities = [] } = useQuery<Personality[]>({
    queryKey: ['personalities'],
    queryFn: apiService.getPersonalities,
  });

  // Update Contact Mutation
  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contact> }) =>
      apiService.updateContact(id, data),
    onSuccess: () => {
      toast('Contact preferences updated successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setEditOpen(false);
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to update contact.', 'error');
    },
  });

  // Toggle Auto Reply directly from list
  const handleToggleAutoReply = (contact: Contact) => {
    updateContactMutation.mutate({
      id: contact.id,
      data: { autoReplyEnabled: !contact.autoReplyEnabled },
    });
  };

  const handleOpenEdit = (contact: Contact) => {
    setSelectedContact(contact);
    setContactName(contact.name);
    setAutoReplyEnabled(contact.autoReplyEnabled);
    setPersonalityId(contact.personalityId || 'friendly');
    setLanguage(contact.language || 'Auto');
    setEditOpen(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact) return;

    updateContactMutation.mutate({
      id: selectedContact.id,
      data: {
        name: contactName,
        autoReplyEnabled,
        personalityId,
        language,
      },
    });
  };

  // Filter and search computation
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'enabled' && c.autoReplyEnabled) ||
      (statusFilter === 'disabled' && !c.autoReplyEnabled);

    return matchesSearch && matchesStatus;
  });

  const languageOptions = [
    { value: 'Auto', label: 'Auto-detect (Malayalam / Manglish / English)' },
    { value: 'Malayalam', label: 'Forced Malayalam' },
    { value: 'Manglish', label: 'Forced Manglish' },
    { value: 'English', label: 'Forced English' },
  ];

  const personalityOptions = [
    ...personalities.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header Panel */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts Management</h1>
          <p className="text-muted-foreground mt-1">Assign custom AI personalities and manage auto-reply toggles per chat</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchContacts();
            toast('Refreshing contact list...', 'success');
          }}
          disabled={contactsLoading}
          className="cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${contactsLoading ? 'animate-spin' : ''}`} />
          Sync Contacts
        </Button>
      </div>

      <Card className="bg-card/45 border border-border/50">
        <CardHeader className="pb-4">
          <CardTitle>All Active Threads</CardTitle>
          <CardDescription>Search and configure specific parameters for individual WhatsApp contacts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter Toggle tabs */}
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="cursor-pointer"
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'enabled' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('enabled')}
                className="cursor-pointer"
              >
                Auto Reply Enabled
              </Button>
              <Button
                variant={statusFilter === 'disabled' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('disabled')}
                className="cursor-pointer"
              >
                Bypassed
              </Button>
            </div>
          </div>

          {/* Contacts Grid/List */}
          {contactsLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading contacts from database...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/10">
              <p className="text-sm text-muted-foreground">No contacts found matching criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-4">Contact Details</th>
                    <th className="px-6 py-4">Assigned AI Personality</th>
                    <th className="px-6 py-4">Language Lock</th>
                    <th className="px-6 py-4 text-center">Auto Reply Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm">
                  {filteredContacts.map((contact) => {
                    const matchedPersonality = personalities.find(p => p.id === contact.personalityId);
                    
                    return (
                      <tr key={contact.id} className="hover:bg-accent/15 transition-colors">
                        {/* Details */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-foreground">{contact.name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {contact.phone.split('@')[0]}
                          </div>
                        </td>
                        
                        {/* Personality */}
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/10 font-medium">
                            {matchedPersonality ? matchedPersonality.name : 'Friendly (Default)'}
                          </span>
                        </td>
                        
                        {/* Language */}
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/10 font-medium">
                            {contact.language || 'Auto'}
                          </span>
                        </td>
                        
                        {/* Toggle switch status */}
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleToggleAutoReply(contact)}
                            className="inline-flex items-center justify-center p-1 rounded-full hover:bg-muted cursor-pointer transition-colors"
                            title={contact.autoReplyEnabled ? 'Disable Auto Reply' : 'Enable Auto Reply'}
                          >
                            {contact.autoReplyEnabled ? (
                              <ToggleRight className="w-7 h-7 text-emerald-500" />
                            ) : (
                              <ToggleLeft className="w-7 h-7 text-muted-foreground" />
                            )}
                          </button>
                        </td>
                        
                        {/* Edit Button */}
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(contact)}
                            className="flex items-center gap-1 cursor-pointer inline-flex"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            Configure
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Configuration Dialog Modal */}
      <Dialog
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Configure Contact Settings"
        maxWidth="md"
      >
        {selectedContact && (
          <form onSubmit={handleSaveContact} className="space-y-5 animate-in fade-in duration-200">
            {/* Display Phone */}
            <div className="p-4 bg-muted/40 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">JID Endpoint</p>
                <p className="font-mono text-sm font-semibold text-foreground mt-0.5">{selectedContact.phone}</p>
              </div>
              <UserCog className="w-5 h-5 text-primary" />
            </div>

            {/* Custom Edit Name */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Display Name</label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
            </div>

            {/* Select Personality */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Response Personality</label>
              <Select
                value={personalityId}
                onChange={(e) => setPersonalityId(e.target.value)}
                options={personalityOptions}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                The personality prompt dictates GPT rules while replying to this contact.
              </p>
            </div>

            {/* Select Language lock */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Language Restraints</label>
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                options={languageOptions}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Set to Auto to automatically respond in the language code matched (Malayalam / Manglish / English).
              </p>
            </div>

            {/* Switch Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <label className="text-sm font-semibold text-foreground">AI Auto Reply Status</label>
                <p className="text-[11px] text-muted-foreground">If turned off, AI will ignore incoming messages from this chat thread</p>
              </div>
              <Switch
                checked={autoReplyEnabled}
                onCheckedChange={setAutoReplyEnabled}
              />
            </div>

            {/* Form actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={updateContactMutation.isPending}
                className="cursor-pointer"
              >
                Save Configuration
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
