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

import { pageLoaders } from "@/lib/pageLoaders";
import { RouteContent } from "@/components/RouteContent";
import { MotionConfig } from "framer-motion";
import { OnboardingGate } from "@/features/onboarding/components/OnboardingGate";

const SuspenseFallback = () => <PageContentSkeleton />;

const BackgroundPreloaderInit = () => {
  useBackgroundPreloader();
  return null;
};

// Lazy-loaded page components
const Dashboard = lazy(pageLoaders.Dashboard);
const Schedule = lazy(pageLoaders.Schedule);
const Tasks = lazy(pageLoaders.Tasks);
const Notes = lazy(pageLoaders.Notes);
const Questions = lazy(pageLoaders.Questions);
const Settings = lazy(pageLoaders.Settings);
const Statistics = lazy(pageLoaders.Statistics);
const AdminImport = lazy(pageLoaders.AdminImport);
const AdminUsers = lazy(pageLoaders.AdminUsers);
const AdminQuestions = lazy(pageLoaders.AdminQuestions);
const Flashcards = lazy(pageLoaders.Flashcards);
const Essays = lazy(pageLoaders.Essays);
const SubscriptionSuccess = lazy(pageLoaders.SubscriptionSuccess);
const Subscription = lazy(pageLoaders.Subscription);
const Simulados = lazy(pageLoaders.Simulados);
const SimuladoActive = lazy(pageLoaders.SimuladoActive);
const SimuladoResults = lazy(pageLoaders.SimuladoResults);
const CreatorDashboard = lazy(pageLoaders.CreatorDashboard);
const Achievements = lazy(pageLoaders.Achievements);
const AdminNotifications = lazy(pageLoaders.AdminNotifications);
const Feedback = lazy(pageLoaders.Feedback);
const AdminFeedback = lazy(pageLoaders.AdminFeedback);
const ReviewErrors = lazy(pageLoaders.ReviewErrors);
const TRICalculator = lazy(pageLoaders.TRICalculator);
const SalesPage = lazy(pageLoaders.SalesPage);
const NotFound = lazy(pageLoaders.NotFound);

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
    <MotionConfig reducedMotion="user">
    <OnboardingGate>
    <StreakProvider>
      <PremiumProvider>
        <HelpTooltipsProvider>
          <PomodoroProvider>
            <BackgroundPreloaderInit />
            <NavbarLayoutContext.Provider value={true}>
              {showNavbar && <Navbar isLayoutRoot />}
              <RouteContent>
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
              </RouteContent>
            </NavbarLayoutContext.Provider>
            <TourOverlay />
            <FloatingPomodoro />
          </PomodoroProvider>
        </HelpTooltipsProvider>
      </PremiumProvider>
    </StreakProvider>
    </OnboardingGate>
    </MotionConfig>
  );
};

export default AppLayout;
