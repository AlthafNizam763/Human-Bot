import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext<{
  activeTab: string;
  setActiveTab: (val: string) => void;
} | null>(null);

export const Tabs: React.FC<{ defaultValue: string; children: React.ReactNode; className?: string }> = ({
  defaultValue,
  children,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`inline-flex items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground ${className}`}>
    {children}
  </div>
);

export const TabsTrigger: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({
  value,
  children,
  className = '',
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used inside Tabs');
  const isActive = context.activeTab === value;
  return (
    <button
      type="button"
      onClick={() => context.setActiveTab(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${
        isActive ? 'bg-card text-foreground shadow-sm' : 'hover:bg-accent/50 hover:text-foreground'
      } ${className}`}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({
  value,
  children,
  className = '',
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used inside Tabs');
  if (context.activeTab !== value) return null;
  return <div className={`mt-2 focus-visible:outline-none ${className}`}>{children}</div>;
};
