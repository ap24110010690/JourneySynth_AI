import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full px-4 sm:px-0">
      {toasts.map((t) => {
        const styles =
          t.type === 'success'
            ? 'bg-[#0F1E2E] border-emerald-500/40 text-emerald-200'
            : t.type === 'error'
            ? 'bg-[#1F1218] border-rose-500/40 text-rose-200'
            : 'bg-[#101B30] border-blue-500/40 text-blue-200';
        const Icon =
          t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info;

        return (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm ${styles}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="flex-1 leading-snug">{t.text}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
