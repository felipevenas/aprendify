import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { StreakProvider } from "@/contexts/StreakContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { HelpTooltipsProvider } from "@/contexts/HelpTooltipsContext";
import { useBackgroundPreloader } from "@/hooks/useBackgroundPreloader";
import HelpButton from "@/components/help/HelpButton";
import TourOverlay from "@/components/help/TourOverlay";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const SuspenseFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const BackgroundPreloaderInit = () => {
  useBackgroundPreloader();
  return null;
};

// Lazy-loaded page components
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const Notes = lazy(() => import("@/pages/Notes"));
const Questions = lazy(() => import("@/pages/Questions"));
const Settings = lazy(() => import("@/pages/Settings"));
const Statistics = lazy(() => import("@/pages/Statistics"));
const AdminImport = lazy(() => import("@/pages/AdminImport"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminQuestions = lazy(() => import("@/pages/AdminQuestions"));
const Flashcards = lazy(() => import("@/pages/Flashcards"));
const Essays = lazy(() => import("@/pages/Essays"));
const SubscriptionSuccess = lazy(() => import("@/pages/SubscriptionSuccess"));
const Subscription = lazy(() => import("@/pages/Subscription"));
const Simulados = lazy(() => import("@/pages/Simulados"));
const SimuladoActive = lazy(() => import("@/pages/SimuladoActive"));
const SimuladoResults = lazy(() => import("@/pages/SimuladoResults"));
const CreatorDashboard = lazy(() => import("@/pages/CreatorDashboard"));
const Achievements = lazy(() => import("@/pages/Achievements"));
const AdminNotifications = lazy(() => import("@/pages/AdminNotifications"));
const Feedback = lazy(() => import("@/pages/Feedback"));
const AdminFeedback = lazy(() => import("@/pages/AdminFeedback"));
const ReviewErrors = lazy(() => import("@/pages/ReviewErrors"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const AppLayout = () => (
  <StreakProvider>
    <PremiumProvider>
      <HelpTooltipsProvider>
        <BackgroundPreloaderInit />
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <main className="flex-1 flex flex-col min-w-0">
              {/* Mobile header with sidebar trigger */}
              <header className="sticky top-0 z-40 flex items-center h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 md:hidden">
                <SidebarTrigger />
                <div className="flex-1" />
              </header>
              <div className="flex-1">
                <Suspense fallback={<SuspenseFallback />}>
                  <Routes>
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
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </div>
            </main>
          </div>
        </SidebarProvider>
        <HelpButton />
        <TourOverlay />
      </HelpTooltipsProvider>
    </PremiumProvider>
  </StreakProvider>
);

export default AppLayout;
