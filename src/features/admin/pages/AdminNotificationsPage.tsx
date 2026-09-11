import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import Navbar from "@/components/Navbar";
import { NotificationsManager } from "../components/NotificationsManager";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * Painel Administrativo de Notificações
 * Permite que administradores publiquem e gerenciem notificações globais de sistema
 */
const AdminNotifications = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (role?.role !== "admin") {
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };

    checkAdminRole();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background app-layout-container">
      <Navbar />

      <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageLoader loading={loading || !isAdmin} variant="list">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gerenciar Notificações</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Gerencie as notificações do sistema enviadas para todos os usuários
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <NotificationsManager />
          </motion.div>
        </PageLoader>
      </main>
    </div>
  );
};

export const AdminNotificationsPage = AdminNotifications;
export default AdminNotifications;
