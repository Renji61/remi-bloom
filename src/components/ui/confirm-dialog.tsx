"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";

interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

interface ConfirmDialogState {
  resolve: (value: boolean) => void;
  options: ConfirmDialogOptions;
}

interface AlertDialogState {
  resolve: (value: void) => void;
  options: { message: string; title?: string };
}

type ConfirmContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue>({
  confirm: () => Promise.resolve(false),
  alert: () => Promise.resolve(),
});

export function useConfirm() {
  return useContext(ConfirmContext);
}

/**
 * Provide  and  helpers that render app-styled dialogs
 * instead of the browser's native  or  (which show the domain name).
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const [alertState, setAlertState] = useState<AlertDialogState | null>(null);

  const confirm = useCallback(
    (options: ConfirmDialogOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({ resolve, options });
      });
    },
    []
  );

  const alert = useCallback(
    (message: string, title?: string): Promise<void> => {
      return new Promise((resolve) => {
        setAlertState({ resolve, options: { message, title } });
      });
    },
    []
  );

  const handleConfirm = useCallback(
    (value: boolean) => {
      confirmState?.resolve(value);
      setConfirmState(null);
    },
    [confirmState]
  );

  const handleAlertDismiss = useCallback(() => {
    alertState?.resolve();
    setAlertState(null);
  }, [alertState]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmState) {
          confirmState.resolve(false);
          setConfirmState(null);
        }
        if (alertState) {
          alertState.resolve();
          setAlertState(null);
        }
      }
    };
    if (confirmState || alertState) {
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [confirmState, alertState]);

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}

      {/* Confirm dialog */}
      <Dialog
        open={!!confirmState}
        onOpenChange={(open) => {
          if (!open && confirmState) {
            confirmState.resolve(false);
            setConfirmState(null);
          }
        }}
      >
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{confirmState?.options.title ?? "REMI Bloom"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {confirmState?.options.message}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => handleConfirm(false)}
            >
              {confirmState?.options.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={confirmState?.options.variant === "danger" ? "danger" : "primary"}
              onClick={() => handleConfirm(true)}
            >
              {confirmState?.options.confirmLabel ?? "OK"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert dialog */}
      <Dialog
        open={!!alertState}
        onOpenChange={(open) => {
          if (!open && alertState) {
            alertState.resolve();
            setAlertState(null);
          }
        }}
      >
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{alertState?.options.title ?? "REMI Bloom"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {alertState?.options.message}
          </p>
          <div className="flex justify-end pt-2">
            <Button onClick={handleAlertDismiss}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
