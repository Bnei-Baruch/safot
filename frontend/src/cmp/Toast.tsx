import React, { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { Snackbar, Alert, Box, Typography } from "@mui/material";

type Severity = "success" | "error" | "warning" | "info";
type ToastContextType = {
  showToast: (message: string, severity: Severity, details?: string) => void;
};

const TOAST_DURATION = 6000;
const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

interface ToastState {
  message: string;
  severity: Severity;
  open: boolean;
  details?: string;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({
    message: "",
    severity: "success",
    open: false,
  });

  const showToast = useCallback((message: string, severity: Severity, details?: string) => {
    setToast({ message, severity, open: true, details });
  }, []);
  const handleClose = () => setToast({ ...toast, open: false });

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Snackbar
        open={toast.open}
        autoHideDuration={toast.details ? null : TOAST_DURATION}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert
          onClose={handleClose}
          severity={toast.severity}
          sx={{ width: "100%", maxWidth: 600 }}
        >
          <Box>
            <Typography>{toast.message}</Typography>
            {toast.details && (
              <Box
                sx={{
                  mt: 1,
                  p: 1,
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                  fontSize: '0.85em',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {toast.details}
              </Box>
            )}
          </Box>
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

