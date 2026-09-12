// Shared loaders let keyboard focus and pointer intent warm the same lazy chunks.
export const pageLoaders = {
  Dashboard: () => import("@/pages/Dashboard"),
  Schedule: () => import("@/pages/Schedule"),
  Tasks: () => import("@/pages/Tasks"),
  Notes: () => import("@/pages/Notes"),
  Questions: () => import("@/pages/Questions"),
  Settings: () => import("@/pages/Settings"),
  Statistics: () => import("@/pages/Statistics"),
  AdminImport: () => import("@/pages/AdminImport"),
  AdminUsers: () => import("@/pages/AdminUsers"),
  AdminQuestions: () => import("@/pages/AdminQuestions"),
  Flashcards: () => import("@/pages/Flashcards"),
  Essays: () => import("@/pages/Essays"),
  SubscriptionSuccess: () => import("@/pages/SubscriptionSuccess"),
  Subscription: () => import("@/pages/Subscription"),
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
  SalesPage: () => import("@/pages/SalesPage"),
  NotFound: () => import("@/pages/NotFound"),
};

const routeLoaders: Record<string, () => Promise<unknown>> = {
  "/dashboard": pageLoaders.Dashboard,
  "/schedule": pageLoaders.Schedule,
  "/tasks": pageLoaders.Tasks,
  "/notes": pageLoaders.Notes,
  "/questions": pageLoaders.Questions,
  "/settings": pageLoaders.Settings,
  "/statistics": pageLoaders.Statistics,
  "/flashcards": pageLoaders.Flashcards,
  "/essays": pageLoaders.Essays,
  "/subscription": pageLoaders.Subscription,
  "/subscription/success": pageLoaders.SubscriptionSuccess,
  "/planos": pageLoaders.SalesPage,
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
};

export function preloadRoute(pathname: string) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;
  // Failed speculation must not create an unhandled rejection. Navigation can retry.
  void routeLoaders[pathname]?.().catch(() => undefined);
}
