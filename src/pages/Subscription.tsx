import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { usePremium } from "@/hooks/usePremium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Crown, 
  CreditCard, 
  Calendar, 
  Settings, 
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageLoader } from "@/components/ui/page-loader";
import { PremiumModal } from "@/components/PremiumModal";

interface SubscriptionDetails {
  id: string;
  status: string;
  plan_type: string | null;
  start_date: string | null;
  end_date: string | null;
  stripe_subscription_id: string | null;
}

/**
 * Página de Assinatura do usuário
 * Permite assinar o Premium ou gerenciar a assinatura atual via Stripe
 */
export default function Subscription() {
  const navigate = useNavigate();
  const { isPremium, isLoading: isPremiumLoading } = usePremium();
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    setIsPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data?.isAdminGrant) {
        toast.info("Sua assinatura foi concedida pelo administrador e não requer gerenciamento pelo Stripe.");
        return;
      }
      
      if (data?.url) {
        window.open(data.url, "_blank");
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error("URL do portal não recebida");
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Erro ao abrir o portal de gerenciamento");
    } finally {
      setIsPortalLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "authorized":
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Ativa
          </Badge>
        );
      case "cancelled":
      case "canceled":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelada
          </Badge>
        );
      case "payment_failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pagamento Pendente
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  const getPlanLabel = (planType: string | null) => {
    switch (planType) {
      case "annual":
        return "Plano Anual";
      case "monthly":
        return "Plano Mensal";
      case "god":
        return "Plano Administrador";
      default:
        return "Plano Premium";
    }
  };

  return (
    <PageLoader loading={isLoading || isPremiumLoading} message="Carregando assinatura...">
      <div className="min-h-screen bg-background app-layout-container">
        <Navbar />
        
        <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gerenciar Assinatura</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Gerencie sua assinatura e métodos de pagamento</p>
              </div>
            </div>

            {!isPremium && !subscription ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Crown className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Você ainda não é Premium</h2>
                  <p className="text-muted-foreground mb-6">
                    Assine o plano Premium para desbloquear todos os recursos
                  </p>
                  <Button onClick={() => setShowPlansModal(true)}>
                    Ver planos disponíveis
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Status Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-primary" />
                      Status da Assinatura
                    </CardTitle>
                    <CardDescription>
                      Informações sobre sua assinatura atual
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      {subscription ? getStatusBadge(subscription.status) : (
                        <Badge variant="secondary">Não encontrada</Badge>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Plano</span>
                      <span className="font-medium">
                        {subscription ? getPlanLabel(subscription.plan_type) : "—"}
                      </span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Data de início</span>
                      <span className="font-medium">
                        {subscription?.start_date 
                          ? format(new Date(subscription.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "—"}
                      </span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Próxima cobrança</span>
                      <span className="font-medium">
                        {subscription?.end_date 
                          ? format(new Date(subscription.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Management Card */}
                {subscription?.stripe_subscription_id && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Gerenciamento
                      </CardTitle>
                      <CardDescription>
                        Gerencie sua assinatura pelo portal do Stripe
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        No portal de gerenciamento você pode:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-primary" />
                          Atualizar seu método de pagamento
                        </li>
                        <li className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          Alterar seu plano (mensal/anual)
                        </li>
                        <li className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-primary" />
                          Cancelar sua assinatura
                        </li>
                      </ul>
                      
                      <Button 
                        onClick={openCustomerPortal}
                        disabled={isPortalLoading}
                        className="w-full mt-4"
                      >
                        {isPortalLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ExternalLink className="w-4 h-4 mr-2" />
                        )}
                        Abrir Portal de Gerenciamento
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Info Card */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium text-foreground mb-1">
                          Dúvidas sobre sua assinatura?
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Se você tiver qualquer problema com sua assinatura ou pagamento, 
                          entre em contato conosco pelo email de suporte.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        </main>
        
        <PremiumModal 
          open={showPlansModal} 
          onOpenChange={setShowPlansModal} 
          isPremium={isPremium} 
        />
      </div>
    </PageLoader>
  );
}
