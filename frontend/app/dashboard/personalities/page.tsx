'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Plus, Edit3, Trash2, HelpCircle, Save, Check } from 'lucide-react';
import { Personality } from '@/types/index';

export default function PersonalitiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPersonality, setSelectedPersonality] = useState<Personality | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');

  // Fetch Personalities
  const { data: personalities = [], isLoading } = useQuery<Personality[]>({
    queryKey: ['personalities'],
    queryFn: apiService.getPersonalities,
  });

  // Create Personality Mutation
  const createMutation = useMutation({
    mutationFn: apiService.createPersonality,
    onSuccess: () => {
      toast('Custom personality created successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['personalities'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to create personality.', 'error');
    }
  });

  // Update Personality Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Personality> }) =>
      apiService.updatePersonality(id, data),
    onSuccess: () => {
      toast('Personality updated successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['personalities'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to update personality.', 'error');
    }
  });

  // Delete Personality Mutation
  const deleteMutation = useMutation({
    mutationFn: apiService.deletePersonality,
    onSuccess: () => {
      toast('Personality deleted and affected contacts updated.', 'success');
      queryClient.invalidateQueries({ queryKey: ['personalities'] });
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to delete personality.', 'error');
    }
  });

  const resetForm = () => {
    setSelectedPersonality(null);
    setName('');
    setDescription('');
    setPrompt('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: Personality) => {
    setSelectedPersonality(p);
    setName(p.name);
    setDescription(p.description);
    setPrompt(p.prompt);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this personality? Any contacts using this profile will fall back to Friendly.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !prompt) {
      toast('Please fill in required fields (Name, Prompt).', 'error');
      return;
    }

    const payload = { name, description, prompt };

    if (selectedPersonality) {
      updateMutation.mutate({ id: selectedPersonality.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header Panel */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Personalities</h1>
          <p className="text-muted-foreground mt-1">Manage custom prompts profiles for different customer segments</p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Profile
        </Button>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading personalities...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {personalities.map((p) => {
            const isSystem = p.id === 'friendly';
            
            return (
              <Card key={p.id} className="bg-card/45 border border-border/50 flex flex-col justify-between hover:border-border/80 transition-all duration-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold">{p.name}</CardTitle>
                    {isSystem && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
                        Default
                      </span>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2 min-h-[40px] mt-1">
                    {p.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <div className="p-3 bg-muted/40 rounded-lg text-xs font-mono line-clamp-4 leading-relaxed text-muted-foreground min-h-[96px]">
                    <span className="font-semibold text-foreground uppercase tracking-wide block text-[10px] mb-1.5">System Prompt Preview:</span>
                    {p.prompt}
                  </div>
                </CardContent>

                <CardFooter className="pt-4 border-t border-border/30 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 cursor-pointer"
                    onClick={() => handleOpenEdit(p)}
                    disabled={isSystem}
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(p.id)}
                    disabled={isSystem || deleteMutation.isPending}
                    className="cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={selectedPersonality ? 'Edit Personality Profile' : 'Create Personality Profile'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Profile Name</label>
            <Input
              placeholder="e.g. Cute Customer Service, Formal Assistant"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Short Description</label>
            <Input
              placeholder="Brief summary of how this profile responds..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">System Instructions Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Act as the account owner. You are friendly, formal... Reply in Malayalam/Manglish..."
              className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1.5 flex items-start gap-1">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Provide instructions telling GPT exactly how to behave, what tone to take, what emojis to use, and how to maintain the simulation.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending || updateMutation.isPending}
              className="cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Save Profile
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
