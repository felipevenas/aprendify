import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { StreakProvider } from "@/contexts/StreakContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { HelpTooltipsProvider } from "@/contexts/HelpTooltipsContext";
import { useBackgroundPreloader } from "@/hooks/useBackgroundPreloader";
import HelpButton from "@/components/help/HelpButton";
import TourOverlay from "@/components/help/TourOverlay";

const SuspenseFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Lazy-loaded page components for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Notes = lazy(() => import("./pages/Notes"));
const Questions = lazy(() => import("./pages/Questions"));
const Settings = lazy(() => import("./pages/Settings"));
const Statistics = lazy(() => import("./pages/Statistics"));
const AdminImport = lazy(() => import("./pages/AdminImport"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminQuestions = lazy(() => import("./pages/AdminQuestions"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const Essays = lazy(() => import("./pages/Essays"));
const SubscriptionSuccess = lazy(() => import("./pages/SubscriptionSuccess"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Simulados = lazy(() => import("./pages/Simulados"));
const SimuladoActive = lazy(() => import("./pages/SimuladoActive"));
const SimuladoResults = lazy(() => import("./pages/SimuladoResults"));
const CreatorDashboard = lazy(() => import("./pages/CreatorDashboard"));
const Achievements = lazy(() => import("./pages/Achievements"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const Feedback = lazy(() => import("./pages/Feedback"));
const AdminFeedback = lazy(() => import("./pages/AdminFeedback"));
const ReviewErrors = lazy(() => import("./pages/ReviewErrors"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Component to initialize background preloader
const BackgroundPreloaderInit = () => {
  useBackgroundPreloader();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        {/* StreakProvider e PremiumProvider fornecem estado global para toda a aplicação */}
        <StreakProvider>
          <PremiumProvider>
            <HelpTooltipsProvider>
              <BackgroundPreloaderInit />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<SuspenseFallback />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/schedule" element={<Schedule />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/questions" element={<Questions />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/statistics" element={<Statistics />} />
                    <Route path="/flashcards" element={<Flashcards />} />
                    <Route path="/essays" element={<Essays />} />
                    <Route path="/subscription" element={<Subscription />} />
                    <Route path="/subscription/success" element={<SubscriptionSuccess />} />
                    <Route path="/admin/import" element={<AdminImport />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/questions" element={<AdminQuestions />} />
                    <Route path="/simulados" element={<Simulados />} />
                    <Route path="/simulados/:id" element={<SimuladoActive />} />
                    <Route path="/simulados/:id/resultado" element={<SimuladoResults />} />
                    <Route path="/creator" element={<CreatorDashboard />} />
                    <Route path="/achievements" element={<Achievements />} />
                    <Route path="/admin/notifications" element={<AdminNotifications />} />
                    <Route path="/feedback" element={<Feedback />} />
                    <Route path="/admin/feedback" element={<AdminFeedback />} />
                    <Route path="/review-errors" element={<ReviewErrors />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                {/* Botão de ajuda flutuante e overlay do tour */}
                <HelpButton />
                <TourOverlay />
              </BrowserRouter>
            </HelpTooltipsProvider>
          </PremiumProvider>
        </StreakProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
