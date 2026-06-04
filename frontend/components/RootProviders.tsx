'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';
import ToastContainer from '@/components/ToastContainer';

export function RootProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    // Load theme from localStorage on client side mount
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const targetTheme = savedTheme || 'dark';
    setTheme(targetTheme);
  }, [setTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastContainer />
    </QueryClientProvider>
  );
}
export default RootProviders;
