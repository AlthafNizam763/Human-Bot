'use client';

import { useToastStore } from '@/hooks/useToast';

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  const bgTypes = {
    success: 'bg-emerald-600 border-emerald-700 text-white',
    error: 'bg-rose-600 border-rose-700 text-white',
    warning: 'bg-amber-500 border-amber-600 text-white',
    info: 'bg-blue-600 border-blue-700 text-white',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center justify-between p-4 rounded-lg border shadow-lg transition-all duration-300 animate-in slide-in-from-bottom-5 ${bgTypes[t.type]}`}
        >
          <span className="text-sm font-medium">{t.message}</span>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="ml-4 hover:opacity-85 text-white/90 p-1 cursor-pointer transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};
export default ToastContainer;
