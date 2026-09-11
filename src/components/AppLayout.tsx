import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { StreakProvider } from "@/contexts/StreakContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { HelpTooltipsProvider } from "@/contexts/HelpTooltipsContext";
import { PomodoroProvider } from "@/contexts/PomodoroContext";
import { useBackgroundPreloader } from "@/hooks/useBackgroundPreloader";
import TourOverlay from "@/components/help/TourOverlay";
import { FloatingPomodoro } from "@/components/dashboard/FloatingPomodoro";
import { PageContentSkeleton } from "@/components/ui/page-skeletons";
import Navbar, { NavbarLayoutContext } from "@/shared/components/layout/Navbar";

const SuspenseFallback = () => <PageContentSkeleton />;

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
const TRICalculator = lazy(() => import("@/pages/TRICalculator"));
const SalesPage = lazy(() => import("@/pages/SalesPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

/**
 * AppLayout wraps authenticated/app routes with heavy providers
 * (Streak, Premium, HelpTooltips) that are NOT needed on Landing/Auth pages.
 * This reduces the initial JS payload for the landing page significantly.
 */
const AppLayout = () => {
  const location = useLocation();
  const isSimuladoRunning =
    location.pathname.startsWith("/simulados/") &&
    !location.pathname.endsWith("/resultado") &&
    location.pathname.split("/").length === 3;
  const isSalesRoute = location.pathname === "/planos" || location.pathname === "/oferta";
  const showNavbar = !isSimuladoRunning && !isSalesRoute;

  return (
    <StreakProvider>
      <PremiumProvider>
        <HelpTooltipsProvider>
          <PomodoroProvider>
            <BackgroundPreloaderInit />
            <NavbarLayoutContext.Provider value={true}>
              {showNavbar && <Navbar isLayoutRoot />}
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
                  <Route path="/planos" element={<SalesPage />} />
                  <Route path="/oferta" element={<SalesPage />} />
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
                  <Route path="/calculadora-tri" element={<TRICalculator />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </NavbarLayoutContext.Provider>
            <TourOverlay />
            <FloatingPomodoro />
          </PomodoroProvider>
        </HelpTooltipsProvider>
      </PremiumProvider>
    </StreakProvider>
  );
};

export default AppLayout;
