import React, { createContext, useContext, useState, ReactNode } from "react";
import { Snackbar, Alert } from "@mui/material";

type Severity = "success" | "error" | "warning" | "info";
type ToastContextType = {
  showToast: (message: string, severity: Severity) => void;
};

const TOAST_DURATION = 3000;
const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; severity: Severity; open: boolean }>({
    message: "",
    severity: "success",
    open: false,
  });

  const showToast = (message: string, severity: Severity) => {
    setToast({ message, severity, open: true });
  };
  const handleClose = () => setToast({ ...toast, open: false });

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Snackbar
        open={toast.open}
        autoHideDuration={TOAST_DURATION}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert onClose={handleClose} severity={toast.severity} sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};

