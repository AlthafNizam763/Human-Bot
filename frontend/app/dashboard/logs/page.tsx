'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Search, Terminal, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { SystemLog } from '@/types/index';

export default function LogsPage() {
  const { toast } = useToast();
  
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [search, setSearch] = useState('');

  // Fetch Logs
  const { data: logs = [], isLoading, refetch } = useQuery<SystemLog[]>({
    queryKey: ['logs'],
    queryFn: apiService.getLogs,
    refetchInterval: 10000, // Auto-refresh logs every 10 seconds
  });

  const handleRefresh = () => {
    refetch();
    toast('Refreshing system logs...', 'success');
  };

  // Filter computation
  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesSearch = log.message.toLowerCase().includes(search.toLowerCase()) || 
      (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(search.toLowerCase()));

    return matchesLevel && matchesSearch;
  });

  const getLevelBadge = (level: SystemLog['level']) => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/15">
            <AlertCircle className="w-3.5 h-3.5" />
            Error
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/15">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/15">
            <Info className="w-3.5 h-3.5" />
            Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header Panel */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
          <p className="text-muted-foreground mt-1">Audit connection status, message flow, and OpenAI API logs</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </Button>
      </div>

      <Card className="bg-card/45 border border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Terminal className="w-5 h-5 text-primary" />
            <CardTitle>Event Log Feed</CardTitle>
          </div>
          <CardDescription>Real-time monitor tracking socket handshakes and response times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search event body or key..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              />
            </div>

            {/* Level Filter tabs */}
            <div className="flex gap-2">
              <Button
                variant={levelFilter === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setLevelFilter('all')}
                className="cursor-pointer font-medium"
              >
                All
              </Button>
              <Button
                variant={levelFilter === 'info' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setLevelFilter('info')}
                className="cursor-pointer font-medium"
              >
                Info
              </Button>
              <Button
                variant={levelFilter === 'warn' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setLevelFilter('warn')}
                className="cursor-pointer font-medium"
              >
                Warnings
              </Button>
              <Button
                variant={levelFilter === 'error' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setLevelFilter('error')}
                className="cursor-pointer font-medium"
              >
                Errors
              </Button>
            </div>
          </div>

          {/* Logs List Container */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-sm text-muted-foreground">Pulling diagnostic event data...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/10">
              <p className="text-sm text-muted-foreground">No events match search filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-4 w-44">Time</th>
                    <th className="px-6 py-4 w-32">Severity</th>
                    <th className="px-6 py-4">Log Message</th>
                    <th className="px-6 py-4">Metadata Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm font-mono">
                  {filteredLogs.map((log) => {
                    const time = log.timestamp 
                      ? new Date(log.timestamp.seconds * 1000).toLocaleString() 
                      : '';

                    return (
                      <tr key={log.id} className="hover:bg-accent/15 transition-colors">
                        <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                          {time}
                        </td>
                        <td className="px-6 py-4">
                          {getLevelBadge(log.level)}
                        </td>
                        <td className="px-6 py-4 font-sans text-foreground leading-relaxed">
                          {log.message}
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground max-w-xs truncate" title={log.metadata ? JSON.stringify(log.metadata, null, 2) : ''}>
                          {log.metadata ? JSON.stringify(log.metadata) : '-'}
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
    </div>
  );
}
