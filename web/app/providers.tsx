"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { shouldRetry } from "@/lib/retry";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchInterval: 5000, staleTime: 2000, retry: shouldRetry } } }));
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="bottom-center" />
    </QueryClientProvider>
  );
}
