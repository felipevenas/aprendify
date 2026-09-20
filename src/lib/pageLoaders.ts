// Shared loaders let keyboard focus and pointer intent warm the same lazy chunks.
export const pageLoaders = {
  Auth: () => import("@/pages/Auth"),
  PrivacyPolicy: () => import("@/pages/PrivacyPolicy"),
  TermsOfService: () => import("@/pages/TermsOfService"),
  SalesPage: () => import("@/pages/SalesPage"),
  CheckoutPage: () => import("@/features/subscription/pages/CheckoutPage"),
  Dashboard: () => import("@/pages/Dashboard"),
  Schedule: () => import("@/pages/Schedule"),
  Tasks: () => import("@/pages/Tasks"),
  Notes: () => import("@/pages/Notes"),
  Questions: () => import("@/pages/Questions"),
  Settings: () => import("@/pages/Settings"),
  AdminImport: () => import("@/pages/AdminImport"),
  AdminUsers: () => import("@/pages/AdminUsers"),
  AdminQuestions: () => import("@/pages/AdminQuestions"),
  Flashcards: () => import("@/pages/Flashcards"),
  Essays: () => import("@/pages/Essays"),
  SubscriptionSuccess: () => import("@/pages/SubscriptionSuccess"),
  Simulados: () => import("@/pages/Simulados"),
  SimuladoActive: () => import("@/pages/SimuladoActive"),
  SimuladoResults: () => import("@/pages/SimuladoResults"),
  CreatorDashboard: () => import("@/pages/CreatorDashboard"),
  Achievements: () => import("@/pages/Achievements"),
  AdminNotifications: () => import("@/pages/AdminNotifications"),
  Feedback: () => import("@/pages/Feedback"),
  AdminFeedback: () => import("@/pages/AdminFeedback"),
  ReviewErrors: () => import("@/pages/ReviewErrors"),
  TRICalculator: () => import("@/pages/TRICalculator"),
  Friends: () => import("@/features/friends/pages/FriendsPage"),
  DirectChat: () => import("@/features/friends/pages/DirectChatPage"),
  FocusChallenge: () => import("@/features/friends/pages/FocusChallengePage"),
  NotFound: () => import("@/pages/NotFound"),
};

const preloadedRoutes = new Map<string, Promise<unknown>>();

const routeLoaders: Record<string, () => Promise<unknown>> = {
  "/dashboard": pageLoaders.Dashboard,
  "/schedule": pageLoaders.Schedule,
  "/tasks": pageLoaders.Tasks,
  "/notes": pageLoaders.Notes,
  "/questions": pageLoaders.Questions,
  "/settings": pageLoaders.Settings,
  "/flashcards": pageLoaders.Flashcards,
  "/essays": pageLoaders.Essays,
  "/subscription/success": pageLoaders.SubscriptionSuccess,
  "/planos": pageLoaders.CheckoutPage,
  "/oferta": pageLoaders.SalesPage,
  "/admin/import": pageLoaders.AdminImport,
  "/admin/users": pageLoaders.AdminUsers,
  "/admin/questions": pageLoaders.AdminQuestions,
  "/simulados": pageLoaders.Simulados,
  "/creator": pageLoaders.CreatorDashboard,
  "/achievements": pageLoaders.Achievements,
  "/admin/notifications": pageLoaders.AdminNotifications,
  "/feedback": pageLoaders.Feedback,
  "/admin/feedback": pageLoaders.AdminFeedback,
  "/review-errors": pageLoaders.ReviewErrors,
  "/calculadora-tri": pageLoaders.TRICalculator,
  "/amigos": pageLoaders.Friends,
};

export function preloadRoute(pathname: string) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;
  const loader = routeLoaders[pathname];
  if (!loader || preloadedRoutes.has(pathname)) return;

  // Keep one promise per route so repeated pointer/focus events never start
  // duplicate work. A failed speculation is discarded so a later navigation
  // can retry the chunk normally.
  const promise = loader().catch((error) => {
    preloadedRoutes.delete(pathname);
    throw error;
  });
  preloadedRoutes.set(pathname, promise);
  void promise.catch(() => undefined);
}
