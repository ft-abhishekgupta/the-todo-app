"use client";

import { NextUIProvider } from "@nextui-org/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./auth-provider";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextUIProvider>
        <NextThemesProvider attribute="class" defaultTheme="dark">
          <AuthProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: "!bg-content1 !text-foreground !border !border-divider",
              }}
            />
          </AuthProvider>
        </NextThemesProvider>
      </NextUIProvider>
    </QueryClientProvider>
  );
}
