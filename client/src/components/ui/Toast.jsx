/* eslint-disable react-refresh/only-export-components */
import { useState, createContext, useContext, useCallback } from "react";
import {
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
  FaTimes,
} from "react-icons/fa";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          const typeStyles = {
            success: "bg-emerald-600 text-white shadow-emerald-700/20",
            error: "bg-rose-600 text-white shadow-rose-700/20",
            warning: "bg-amber-600 text-white shadow-amber-700/20",
            info: "bg-blue-600 text-white shadow-blue-700/20",
          }[toast.type] || "bg-slate-800 text-white";

          const icon = {
            success: <FaCheckCircle className="text-lg shrink-0" />,
            error: <FaExclamationCircle className="text-lg shrink-0" />,
            warning: <FaExclamationCircle className="text-lg shrink-0" />,
            info: <FaInfoCircle className="text-lg shrink-0" />,
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg transition-all animate-bounce-in text-sm font-medium ${typeStyles}`}
            >
              <div className="flex items-center gap-2.5">
                {icon}
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-75 hover:opacity-100 p-1"
                aria-label="Close notification"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if not inside provider
    return {
      addToast: (msg, type) => console.log(`[Toast ${type}]: ${msg}`),
      removeToast: () => {},
    };
  }
  return context;
}

export default ToastProvider;
