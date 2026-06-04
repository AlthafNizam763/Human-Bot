'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { HelpCircle, Save, KeyRound, Clock, Settings, ShieldAlert } from 'lucide-react';
import { UserSettings } from '@/types/index';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Settings state variables
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [replyLength, setReplyLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [memoryLength, setMemoryLength] = useState(10);
  const [delayMin, setDelayMin] = useState(3);
  const [delayMax, setDelayMax] = useState(15);
  const [busyMode, setBusyMode] = useState(false);
  const [nightMode, setNightMode] = useState(false);

  // Fetch current user settings
  const { data: settings, isLoading } = useQuery<UserSettings & { hasApiKey?: boolean }>({
    queryKey: ['settings'],
    queryFn: apiService.getSettings,
  });

  // Hydrate form when settings fetch completes
  useEffect(() => {
    if (settings) {
      setOpenaiModel(settings.openaiModel || 'gpt-4o-mini');
      setReplyLength(settings.replyLength || 'medium');
      setMemoryLength(settings.memoryLength ?? 10);
      setDelayMin(settings.delayMin ?? 3);
      setDelayMax(settings.delayMax ?? 15);
      setBusyMode(settings.busyMode ?? false);
      setNightMode(settings.nightMode ?? false);
      // Key state is handled separately
      setOpenaiApiKey('');
    }
  }, [settings]);

  // Update Settings mutation
  const updateMutation = useMutation({
    mutationFn: apiService.updateSettings,
    onSuccess: () => {
      toast('Global settings saved successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      // Reset API key input after save
      setOpenaiApiKey('');
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to save settings.', 'error');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (delayMin < 0 || delayMax < 0 || delayMin > delayMax) {
      toast('Typing delays must be valid and Min Delay cannot exceed Max Delay.', 'error');
      return;
    }

    if (memoryLength < 1 || memoryLength > 30) {
      toast('Conversation memory length must be between 1 and 30 messages.', 'error');
      return;
    }

    const payload: any = {
      openaiModel,
      replyLength,
      memoryLength: Number(memoryLength),
      delayMin: Number(delayMin),
      delayMax: Number(delayMax),
      busyMode,
      nightMode,
    };

    if (openaiApiKey.trim() !== '') {
      payload.openaiApiKey = openaiApiKey;
    }

    updateMutation.mutate(payload);
  };

  const modelOptions = [
    { value: 'gpt-4o-mini', label: 'GPT-4o-Mini (Fast, Cost-effective - Recommended)' },
    { value: 'gpt-4o', label: 'GPT-4o (High precision, Vision capable)' },
  ];

  const lengthOptions = [
    { value: 'short', label: 'Short (1-2 sentences, quick replies)' },
    { value: 'medium', label: 'Medium (3-4 sentences, natural details)' },
    { value: 'long', label: 'Long (1-2 paragraphs, detailed support)' },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-sm text-muted-foreground">Loading configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-1">Configure global AI models, safety features, and human-like typing behaviors</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* OpenAI Credentials */}
        <Card className="bg-card/45 border border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-foreground font-bold">
              <KeyRound className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">OpenAI Configuration</CardTitle>
            </div>
            <CardDescription>Enter your OpenAI API Credentials and choose your default language model</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">OpenAI API Key</label>
              <Input
                type="password"
                placeholder={settings?.hasApiKey ? "••••••••••••••••••••••••••••••••" : "sk-proj-..."}
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {settings?.hasApiKey 
                  ? 'Key is saved. To overwrite, enter a new API key value.' 
                  : 'Your API key is stored securely and never shared.'
                }
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">GPT Language Model</label>
              <Select
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                options={modelOptions}
              />
            </div>
          </CardContent>
        </Card>

        {/* Messaging limits & Simulation parameters */}
        <Card className="bg-card/45 border border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-foreground font-bold">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Human Reply Simulation</CardTitle>
            </div>
            <CardDescription>Configure AI response length, context memory, and dynamic typing simulation delay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Min Typings Delay (seconds)</label>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  value={delayMin}
                  onChange={(e) => setDelayMin(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Max Typings Delay (seconds)</label>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  value={delayMax}
                  onChange={(e) => setDelayMax(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Response Word Length</label>
                <Select
                  value={replyLength}
                  onChange={(e) => setReplyLength(e.target.value as any)}
                  options={lengthOptions}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Context Memory Size (last messages)</label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={memoryLength}
                  onChange={(e) => setMemoryLength(Number(e.target.value))}
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  The number of historical chat bubbles sent to GPT to maintain conversation flow.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature toggles */}
        <Card className="bg-card/45 border border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-foreground font-bold">
              <Settings className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">System Automation Modes</CardTitle>
            </div>
            <CardDescription>Activate specific automated behaviors depending on your availability</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/30">
            {/* Busy Mode */}
            <div className="flex items-center justify-between py-4">
              <div>
                <label className="font-semibold text-foreground">Global Busy Mode</label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  If enabled, all AI responses are bypassed immediately (ignores incoming WhatsApp texts)
                </p>
              </div>
              <Switch
                checked={busyMode}
                onCheckedChange={setBusyMode}
              />
            </div>

            {/* Night Mode */}
            <div className="flex items-center justify-between py-4">
              <div>
                <label className="font-semibold text-foreground">Global Night Mode</label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  If active, stops automated replies between 10:00 PM and 7:00 AM in your server timezone
                </p>
              </div>
              <Switch
                checked={nightMode}
                onCheckedChange={setNightMode}
              />
            </div>
          </CardContent>
        </Card>

        {/* Safety Warning */}
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Active Safety Filter Warning</p>
            <p>Our platform automatically checks messages for banking alerts, UPI passwords, and OTP digits. AI will never process or respond to sensitive transactions to guarantee secure messaging.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isPending}
            className="w-full md:w-auto px-8 cursor-pointer"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Configurations
          </Button>
        </div>
      </form>
    </div>
  );
}
