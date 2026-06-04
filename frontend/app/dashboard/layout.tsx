'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/Sidebar';
import { useAppStore } from '@/store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { LogOut, Sun, Moon, Link as LinkIcon, Radio, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useAppStore();
  const { toast } = useToast();
  const router = useRouter();

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // WhatsApp connection polling (every 5 seconds)
  const { data: conn } = useQuery({
    queryKey: ['whatsappStatus'],
    queryFn: apiService.getConnectionStatus,
    refetchInterval: 5000,
    enabled: !!user,
  });

  const handleLogout = async () => {
    try {
      await signOut();
      toast('Signed out successfully.', 'info');
      router.push('/');
    } catch {
      toast('Failed to sign out.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Determine Connection Status Badge
  const getStatusBadge = () => {
    if (!conn) return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Radio className="w-3 h-3 animate-pulse" /> Offline</span>;
    
    switch (conn.status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Connected ({conn.phone})
          </span>
        );
      case 'qr':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <LinkIcon className="w-3.5 h-3.5" />
            Link Device (QR Code Ready)
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Connecting...
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <CircleAlert className="w-3.5 h-3.5" />
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header toolbar */}
        <header className="h-16 border-b border-border bg-card/25 backdrop-blur-md px-8 flex items-center justify-between z-10">
          <div>
            {getStatusBadge()}
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
              {user.email}
            </span>
            
            {/* Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Logout */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* Dynamic page container */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
