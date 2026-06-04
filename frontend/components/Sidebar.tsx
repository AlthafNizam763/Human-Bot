'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Smile,
  Terminal,
  Settings,
  Bot,
  Activity
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Contacts', href: '/dashboard/contacts', icon: Users },
    { name: 'Conversations', href: '/dashboard/conversations', icon: MessageSquare },
    { name: 'Personalities', href: '/dashboard/personalities', icon: Smile },
    { name: 'Live Status', href: '/dashboard/status', icon: Activity },
    { name: 'System Logs', href: '/dashboard/logs', icon: Terminal },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <aside className={`w-64 border-r border-border bg-card/45 backdrop-blur-md flex flex-col h-full ${className}`}>
      {/* Brand Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/20">
          <Bot className="w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          WhatsApp AI
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer Branding */}
      <div className="p-4 border-t border-border flex items-center justify-center">
        <span className="text-xs text-muted-foreground font-mono">v1.0.0 Stable</span>
      </div>
    </aside>
  );
}
export default Sidebar;
