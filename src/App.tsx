import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AppSkeleton } from "@/components/ui/page-skeletons";
import { pageLoaders } from "@/lib/pageLoaders";

const SuspenseFallback = () => <AppSkeleton />;

// Light pages that don't need heavy providers
const Auth = lazy(pageLoaders.Auth);
const SalesPage = lazy(pageLoaders.SalesPage);

// Heavy app layout with providers - only loaded when navigating to app routes
const AppLayout = lazy(() => import("./components/AppLayout"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de dados considerados frescos
      gcTime: 1000 * 60 * 10,   // 10 minutos de retenção em memória (anteriormente cacheTime)
      refetchOnWindowFocus: false, // Evita refetch automático ao alternar abas do navegador
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true }}>
          <Suspense fallback={<SuspenseFallback />}>
            <Routes>
              {/* Light routes - no heavy providers loaded */}
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/planos" element={<SalesPage />} />
              <Route path="/oferta" element={<SalesPage />} />
              {/* All other routes go through AppLayout which loads providers */}
              <Route path="/*" element={<AppLayout />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
