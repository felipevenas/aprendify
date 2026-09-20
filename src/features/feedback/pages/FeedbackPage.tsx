import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { MessageSquarePlus } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PageLoader } from "@/components/ui/page-loader";
import { useFeedback } from "../hooks/useFeedback";
import FeedbackForm from "../components/FeedbackForm";
import FeedbackTicketList from "../components/FeedbackTicketList";

export const FeedbackPage = () => {
  const navigate = useNavigate();
  const { tickets, loading, submitting, submitFeedback } = useFeedback();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      }
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background app-layout-container">
      <Navbar />
      <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 py-6 sm:py-8">
        <PageLoader loading={loading} variant="list">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                <MessageSquarePlus className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Falar com Suporte
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Envie sugestões, melhorias ou reporte problemas
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <FeedbackForm onSubmit={submitFeedback} submitting={submitting} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <FeedbackTicketList tickets={tickets} />
            </motion.div>
          </div>
        </PageLoader>
      </main>
    </div>
  );
};

export default FeedbackPage;
