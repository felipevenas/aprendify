import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, FileText, Megaphone, Wrench, Sparkles, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SystemNotification {
  id: string;
  title: string;
  content: string;
  notification_type: string;
  created_at: string;
  is_read?: boolean;
}

const notificationIcons: Record<string, React.ReactNode> = {
  update: <Sparkles className="h-4 w-4 text-blue-500" />,
  patch_notes: <FileText className="h-4 w-4 text-green-500" />,
  announcement: <Megaphone className="h-4 w-4 text-amber-500" />,
  maintenance: <Wrench className="h-4 w-4 text-orange-500" />,
};

const notificationColors: Record<string, string> = {
  update: "bg-blue-500/10 border-blue-500/20",
  patch_notes: "bg-green-500/10 border-green-500/20",
  announcement: "bg-amber-500/10 border-amber-500/20",
  maintenance: "bg-orange-500/10 border-orange-500/20",
};

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAndNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);
      await fetchNotifications(user.id);
    };

    fetchUserAndNotifications();
  }, []);

  const fetchNotifications = async (uid: string) => {
    setLoading(true);
    try {
      // Busca notificações ativas através da view segura (sem expor created_by)
      const { data: notifs, error: notifsError } = await supabase
        .from("system_notifications_public")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (notifsError) throw notifsError;

      // Busca leituras do usuário
      const { data: reads, error: readsError } = await supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", uid);

      if (readsError) throw readsError;

      const readIds = new Set(reads?.map(r => r.notification_id) || []);

      // Marca quais foram lidas
      const enrichedNotifs = (notifs || []).map(n => ({
        ...n,
        is_read: readIds.has(n.id),
      }));

      setNotifications(enrichedNotifs);
      setUnreadCount(enrichedNotifs.filter(n => !n.is_read).length);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("notification_reads")
        .insert({
          user_id: userId,
          notification_id: notificationId,
        });

      if (error && !error.message.includes("duplicate")) throw error;

      // Atualiza estado local
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    const unreadNotifs = notifications.filter(n => !n.is_read);
    
    try {
      for (const notif of unreadNotifs) {
        await supabase
          .from("notification_reads")
          .insert({
            user_id: userId,
            notification_id: notif.id,
          });
      }

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full hover:bg-primary/10 h-9 w-9 sm:h-10 sm:w-10 transition-all duration-300"
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 h-4 w-4 sm:h-5 sm:w-5 bg-destructive text-destructive-foreground text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-96 p-0 rounded-xl shadow-xl sm:w-96">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b gap-2">
          <h3 className="font-semibold text-sm sm:text-base">Notificações</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-7 px-2 sm:px-3 shrink-0"
            >
              <Check className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Marcar todas como lidas</span>
              <span className="sm:hidden">Marcar lidas</span>
            </Button>
          )}
        </div>

        <ScrollArea className="h-[60vh] max-h-[400px] sm:h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {notifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                  className={cn(
                    "p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-all duration-200",
                    notification.is_read
                      ? "bg-muted/30 opacity-70"
                      : notificationColors[notification.notification_type] || "bg-muted",
                    !notification.is_read && "hover:scale-[1.02]"
                  )}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="p-1 sm:p-1.5 rounded-lg bg-background/50 shrink-0">
                      {notificationIcons[notification.notification_type] || <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                        <h4 className={cn(
                          "font-medium text-xs sm:text-sm leading-tight break-words",
                          !notification.is_read && "font-semibold"
                        )}>
                          {notification.title}
                        </h4>
                        {!notification.is_read && (
                          <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2 break-words">
                        {notification.content}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-1.5 sm:mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
