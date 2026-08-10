import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "../styles/toast.css";

const ToastContext = createContext(null);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutIds = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));

    if (timeoutIds.current[id]) {
      clearTimeout(timeoutIds.current[id]);
      delete timeoutIds.current[id];
    }
  }, []);

  const showToast = useCallback((message, type = "success") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((current) => [...current, { id, message, type }]);

    timeoutIds.current[id] = setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  useEffect(() => {
    const currentTimeouts = timeoutIds.current;

    return () => {
      Object.values(currentTimeouts).forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutIds.current = {};
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role="status"
          >
            <div className="toast-content">
              <div className="toast-badge" />
              <p className="toast-message">{toast.message}</p>
            </div>

            <button
              className="toast-close"
              type="button"
              aria-label="Fechar aviso"
              onClick={() => removeToast(toast.id)}
            >
              {"\u00D7"}
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}

export default ToastProvider;
