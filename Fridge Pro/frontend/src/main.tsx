import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import App from "./App.tsx";
import "./index.css";

// Configuration React Query optimisée pour PWA mobile (reprise d'arrière-plan et démarrage à froid Render)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.response?.status || error?.statusCode;
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#363636",
              color: "#fff",
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
