import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Tasks from "./pages/Tasks";
import Subjects from "./pages/Subjects";
import Notes from "./pages/Notes";
import Questions from "./pages/Questions";
import Settings from "./pages/Settings";
import Statistics from "./pages/Statistics";
import AdminImport from "./pages/AdminImport";
import AdminUsers from "./pages/AdminUsers";
import Flashcards from "./pages/Flashcards";
import Essays from "./pages/Essays";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import Subscription from "./pages/Subscription";
import Simulados from "./pages/Simulados";
import SimuladoActive from "./pages/SimuladoActive";
import SimuladoResults from "./pages/SimuladoResults";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/subjects" element={<Subjects />} />
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
            <Route path="/simulados" element={<Simulados />} />
            <Route path="/simulados/:id" element={<SimuladoActive />} />
            <Route path="/simulados/:id/resultado" element={<SimuladoResults />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
