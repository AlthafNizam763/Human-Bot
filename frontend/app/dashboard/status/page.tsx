'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Activity, 
  Briefcase, 
  Home, 
  Users, 
  Car, 
  Dumbbell, 
  Compass, 
  Moon, 
  Zap, 
  CheckCircle2, 
  Trees, 
  Save, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';

type StatusType = 'office' | 'home' | 'meeting' | 'driving' | 'gym' | 'outside' | 'travel' | 'sleeping' | 'busy' | 'available';

interface BotStatus {
  currentStatus: StatusType;
  customStatus: string;
  busyMode: boolean;
  lastUpdated?: any;
}

const statusConfigs: Record<StatusType, {
  label: string;
  icon: any;
  color: string;
  hover: string;
  active: string;
  gradient: string;
  description: string;
}> = {
  available: {
    label: 'Available',
    icon: CheckCircle2,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    hover: 'hover:border-emerald-500/40 hover:bg-emerald-500/5',
    active: 'border-emerald-500 bg-emerald-500/15 shadow-md shadow-emerald-500/20 text-emerald-300 font-semibold scale-[1.02]',
    gradient: 'from-emerald-500/20 via-teal-500/5 to-transparent',
    description: 'Fully active. AI replies naturally and promptly without excuse.'
  },
  office: {
    label: 'Office',
    icon: Briefcase,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    hover: 'hover:border-blue-500/40 hover:bg-blue-500/5',
    active: 'border-blue-500 bg-blue-500/15 shadow-md shadow-blue-500/20 text-blue-300 font-semibold scale-[1.02]',
    gradient: 'from-blue-500/20 via-indigo-500/5 to-transparent',
    description: 'At work. AI mentions you are working at the office.'
  },
  home: {
    label: 'Home',
    icon: Home,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    hover: 'hover:border-indigo-500/40 hover:bg-indigo-500/5',
    active: 'border-indigo-500 bg-indigo-500/15 shadow-md shadow-indigo-500/20 text-indigo-300 font-semibold scale-[1.02]',
    gradient: 'from-indigo-500/20 via-purple-500/5 to-transparent',
    description: 'Relaxing. AI responds with a casual home-vibe tone.'
  },
  meeting: {
    label: 'Meeting',
    icon: Users,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    hover: 'hover:border-purple-500/40 hover:bg-purple-500/5',
    active: 'border-purple-500 bg-purple-500/15 shadow-md shadow-purple-500/20 text-purple-300 font-semibold scale-[1.02]',
    gradient: 'from-purple-500/20 via-pink-500/5 to-transparent',
    description: 'In a meeting. AI explains that you are in a session right now.'
  },
  driving: {
    label: 'Driving',
    icon: Car,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    hover: 'hover:border-amber-500/40 hover:bg-amber-500/5',
    active: 'border-amber-500 bg-amber-500/15 shadow-md shadow-amber-500/20 text-amber-300 font-semibold scale-[1.02]',
    gradient: 'from-amber-500/20 via-orange-500/5 to-transparent',
    description: 'Driving. AI answers you are on the road/behind the wheel.'
  },
  gym: {
    label: 'Gym',
    icon: Dumbbell,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    hover: 'hover:border-rose-500/40 hover:bg-rose-500/5',
    active: 'border-rose-500 bg-rose-500/15 shadow-md shadow-rose-500/20 text-rose-300 font-semibold scale-[1.02]',
    gradient: 'from-rose-500/20 via-red-500/5 to-transparent',
    description: 'Working out. AI tells people you are working out at the gym.'
  },
  outside: {
    label: 'Outside',
    icon: Trees,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    hover: 'hover:border-emerald-500/40 hover:bg-emerald-500/5',
    active: 'border-emerald-500 bg-emerald-500/15 shadow-md shadow-emerald-500/20 text-emerald-300 font-semibold scale-[1.02]',
    gradient: 'from-emerald-500/20 via-teal-500/5 to-transparent',
    description: 'Outdoors. AI mentions you are out/away from keyboard.'
  },
  travel: {
    label: 'Travel',
    icon: Compass,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    hover: 'hover:border-cyan-500/40 hover:bg-cyan-500/5',
    active: 'border-cyan-500 bg-cyan-500/15 shadow-md shadow-cyan-500/20 text-cyan-300 font-semibold scale-[1.02]',
    gradient: 'from-cyan-500/20 via-sky-500/5 to-transparent',
    description: 'Traveling. AI replies that you are currently traveling/tripping.'
  },
  sleeping: {
    label: 'Sleeping',
    icon: Moon,
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    hover: 'hover:border-violet-500/40 hover:bg-violet-500/5',
    active: 'border-violet-500 bg-violet-500/15 shadow-md shadow-violet-500/20 text-violet-300 font-semibold scale-[1.02]',
    gradient: 'from-violet-500/20 via-purple-500/5 to-transparent',
    description: 'Sleeping. AI replies that you are asleep or winding down.'
  },
  busy: {
    label: 'Busy',
    icon: Zap,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    hover: 'hover:border-orange-500/40 hover:bg-orange-500/5',
    active: 'border-orange-500 bg-orange-500/15 shadow-md shadow-orange-500/20 text-orange-300 font-semibold scale-[1.02]',
    gradient: 'from-orange-500/20 via-amber-500/5 to-transparent',
    description: 'Busy. AI responds with a brief, casual excuse to follow up later.'
  }
};

export default function StatusPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [currentStatus, setCurrentStatus] = useState<StatusType>('available');
  const [customStatus, setCustomStatus] = useState('');
  const [busyMode, setBusyMode] = useState(false);

  // Fetch current status
  const { data: statusData, isLoading, refetch } = useQuery<BotStatus>({
    queryKey: ['botStatus'],
    queryFn: apiService.getBotStatus,
  });

  // Hydrate local state when data is loaded
  useEffect(() => {
    if (statusData) {
      setCurrentStatus(statusData.currentStatus || 'available');
      setCustomStatus(statusData.customStatus || '');
      setBusyMode(statusData.busyMode ?? false);
    }
  }, [statusData]);

  // Mutation to update status
  const updateMutation = useMutation({
    mutationFn: apiService.updateBotStatus,
    onSuccess: () => {
      toast('Live status updated successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['botStatus'] });
    },
    onError: (err: any) => {
      toast(err.message || 'Failed to update live status.', 'error');
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      currentStatus,
      customStatus,
      busyMode
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-sm text-muted-foreground">Retrieving live status...</p>
      </div>
    );
  }

  const activeConfig = statusConfigs[currentStatus];
  const ActiveIcon = activeConfig.icon;

  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Live Status</h1>
          <p className="text-muted-foreground mt-1">Simulate real-time location, activity contexts, and busy modes for conversational AI replies</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          className="w-fit self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Hero Display Card */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card/30 backdrop-blur-md p-6 md:p-8">
        {/* Dynamic Glowing background gradient depending on selected status */}
        <div className={`absolute inset-0 bg-gradient-to-r ${activeConfig.gradient} opacity-40 transition-all duration-500 -z-10`} />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 md:gap-5">
            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center border transition-all duration-500 ${activeConfig.color} shadow-lg shadow-black/30`}>
              <ActiveIcon className="w-7 h-7 md:w-8 md:h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Current Status</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mt-0.5">{activeConfig.label}</h2>
              {customStatus && (
                <p className="text-sm text-primary font-medium mt-1 font-mono">
                  &ldquo;{customStatus}&rdquo;
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {busyMode && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-rose-500/20 bg-rose-500/10 text-rose-400">
                🔴 Silence Mode (Busy)
              </span>
            )}
            {!busyMode && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                🟢 Auto-Responding
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card className="bg-card/45 border border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-bold">Select Active Activity/Location</CardTitle>
            <CardDescription>Choose your current status to shape AI context. Replies will integrate this state naturally</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Grid of status choices */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              {(Object.keys(statusConfigs) as StatusType[]).map((status) => {
                const config = statusConfigs[status];
                const IconComponent = config.icon;
                const isSelected = currentStatus === status;

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setCurrentStatus(status)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all duration-300 cursor-pointer ${
                      isSelected ? config.active : `border-border/40 bg-card/25 text-muted-foreground ${config.hover}`
                    }`}
                  >
                    <IconComponent className={`w-6 h-6 mb-2.5 transition-transform duration-300 ${isSelected ? '' : 'text-muted-foreground/80'}`} />
                    <span className="text-sm font-semibold">{config.label}</span>
                  </button>
                );
              })}
            </div>
            
            <p className="text-xs text-muted-foreground mt-4 italic">
              * Selected status context: <span className="font-semibold text-primary">{activeConfig.description}</span>
            </p>
          </CardContent>
        </Card>

        {/* Custom Status & Busy mode details */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 bg-card/45 border border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-bold">Custom Status Text</CardTitle>
              <CardDescription>Provide a custom phrase representing exactly what you are doing (e.g. &quot;eating lunch&quot;, &quot;in client call&quot;)</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="text"
                placeholder="Describe your current status (optional)..."
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                maxLength={60}
              />
            </CardContent>
          </Card>

          <Card className="bg-card/45 border border-border/50 flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-base font-bold">Silence Mode</CardTitle>
              <CardDescription>Disable AI responses immediately</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between pb-6">
              <div>
                <label className="font-semibold text-sm text-foreground">Busy Mode Toggle</label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Bypass all AI triggers</p>
              </div>
              <Switch
                checked={busyMode}
                onCheckedChange={setBusyMode}
              />
            </CardContent>
          </Card>
        </div>

        {/* Info panel */}
        <div className="p-4 bg-primary/10 border border-primary/20 text-primary-foreground/90 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-primary">Context Integration Active</p>
            <p className="text-muted-foreground">The AI engine incorporates this status context directly when answering location-related questions (e.g., &ldquo;evda?&rdquo;) or delay-related questions (e.g., &ldquo;reply tharathe entha?&rdquo;), ensuring responses are natural, human-like, and highly accurate.</p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isPending}
            className="w-full md:w-auto px-8 cursor-pointer"
          >
            <Save className="w-4 h-4 mr-2" />
            Apply Live Status
          </Button>
        </div>
      </form>
    </div>
  );
}
