import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { XIcon } from "./icons";

type SnackType = "ok" | "error";

type SnackbarContextValue = {
  showSnackbar: (message: string, type: SnackType, duration?: number | null) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const typeStyles: Record<SnackType, string> = {
  ok: "border-positive bg-positive text-white",
  error: "border-negative bg-negative text-white",
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snack, setSnack] = useState<{ message: string; type: SnackType } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSnackbar = useCallback((message: string, type: SnackType, duration: number | null = 3500) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setSnack({ message, type });
    if (duration !== null) {
      timerRef.current = setTimeout(() => setSnack(null), duration);
    }
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSnack(null);
  }, []);

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <div
        aria-live="polite"
        className={`fixed top-10 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${snack ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
          }`}
      >
        <div
          className={`flex items-center justify-between gap-3 border rounded-lg px-4 py-3 text-sm shadow-lg w-full max-w-sm min-w-[350px] ${snack ? typeStyles[snack.type] : ""
            }`}
        >
          <span>{snack?.message}</span>
          <button
            onClick={dismiss}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Lukk"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
  return ctx;
}
