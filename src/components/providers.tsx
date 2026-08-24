"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [query_client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            retry: (count, error: any) => count < 1 && error?.status >= 500,
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={query_client}>
      {children}
      <Toaster
        richColors
        position="top-right"
        toastOptions={{ className: "rounded-2xl border-white/80 shadow-2xl" }}
      />
    </QueryClientProvider>
  );
}
