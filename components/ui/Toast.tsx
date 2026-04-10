"use client";

/**
 * Minimal toast notification system — no npm dependencies.
 * Usage: wrap app in <ToastProvider>, then const { toast } = useToast();
 */

import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error";
}

interface ToastContextValue {
  toast: (message: string, type?: "success" | "error") => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg shadow-lg text-body-sm font-medium animate-[slideIn_0.2s_ease-out] ${
                t.type === "success"
                  ? "bg-nah-blue text-white"
                  : "bg-danger text-white"
              }`}
            >
              {t.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {t.message}
              <button onClick={() => dismiss(t.id)} className="ml-2 opacity-70 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
