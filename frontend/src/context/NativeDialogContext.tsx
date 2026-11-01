import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type DialogType = 'info' | 'success' | 'warning' | 'error';

interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  isConfirm?: boolean;
  isPrompt?: boolean;
  defaultValue?: string;
  promptPlaceholder?: string;
}

interface ToastOptions {
  message: string;
  type?: DialogType;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface NativeDialogContextType {
  showAlert: (message: string, title?: string, type?: DialogType) => Promise<void>;
  showConfirm: (message: string, title?: string, confirmText?: string, cancelText?: string) => Promise<boolean>;
  showPrompt: (message: string, defaultValue?: string, title?: string, placeholder?: string) => Promise<string | null>;
  showToast: (message: string, type?: DialogType, duration?: number) => void;
}

const NativeDialogContext = createContext<NativeDialogContextType | undefined>(undefined);

export const NativeDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<(DialogOptions & { resolve: (val: any) => void }) | null>(null);
  const [promptInput, setPromptInput] = useState<string>('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showAlert = useCallback((message: string, title: string = 'Notice', type: DialogType = 'info'): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        title,
        message,
        type,
        confirmText: 'Acknowledge',
        isConfirm: false,
        resolve: () => resolve()
      });
    });
  }, []);

  const showConfirm = useCallback((
    message: string,
    title: string = 'Confirm Action',
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setModal({
        title,
        message,
        type: 'warning',
        confirmText,
        cancelText,
        isConfirm: true,
        resolve: (confirmed: boolean) => resolve(confirmed)
      });
    });
  }, []);

  const showPrompt = useCallback((
    message: string,
    defaultValue: string = '',
    title: string = 'Input Required',
    placeholder: string = ''
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptInput(defaultValue);
      setModal({
        title,
        message,
        type: 'info',
        confirmText: 'Submit',
        cancelText: 'Cancel',
        isConfirm: true,
        isPrompt: true,
        defaultValue,
        promptPlaceholder: placeholder,
        resolve: (val: string | null) => resolve(val)
      });
    });
  }, []);

  const showToast = useCallback((message: string, type: DialogType = 'info', duration: number = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const handleConfirm = () => {
    if (modal) {
      if (modal.isPrompt) {
        modal.resolve(promptInput);
      } else {
        modal.resolve(true);
      }
      setModal(null);
    }
  };

  const handleCancel = () => {
    if (modal) {
      if (modal.isPrompt) {
        modal.resolve(null);
      } else {
        modal.resolve(false);
      }
      setModal(null);
    }
  };

  // Close modal on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modal]);

  const getIcon = (type?: DialogType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-sky-400 shrink-0" />;
    }
  };

  return (
    <NativeDialogContext.Provider value={{ showAlert, showConfirm, showPrompt, showToast }}>
      {children}

      {/* Modern In-App Dark Themed Modal */}
      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-150 p-4">
          <div
            className="w-full max-w-md bg-[#121316] border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                {getIcon(modal.type)}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                  {modal.title}
                </h3>
                <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed break-words whitespace-pre-wrap">
                  {modal.message}
                </p>

                {modal.isPrompt && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleConfirm();
                    }}
                    className="mt-3"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      placeholder={modal.promptPlaceholder || 'Type here...'}
                      className="w-full px-3 py-2 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/50"
                    />
                  </form>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
              {modal.isConfirm && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                >
                  {modal.cancelText || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-colors ${
                  modal.type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
                    : modal.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                }`}
              >
                {modal.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Dark Glass Toast Tray */}
      <div className="fixed bottom-6 right-6 z-[9998] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 p-3.5 rounded-xl bg-[#121316]/95 border border-zinc-800 text-zinc-100 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200"
          >
            {getIcon(toast.type)}
            <p className="text-xs text-zinc-300 flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </NativeDialogContext.Provider>
  );
};

export const useNativeDialog = () => {
  const context = useContext(NativeDialogContext);
  if (!context) {
    throw new Error('useNativeDialog must be used within a NativeDialogProvider');
  }
  return context;
};
