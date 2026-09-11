import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Copy, CheckCircle, Wallet, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreatorDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

interface CreatorData {
  coupon_code: string;
  is_active: boolean;
  created_at: string;
  pix_key_type: string | null;
  pix_key: string | null;
}

interface RedemptionCount {
  total: number;
  thisMonth: number;
}

const pixKeyTypeLabels: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave Aleatória",
};

const CreatorDetailsModal = ({ open, onOpenChange, userId, userName }: CreatorDetailsModalProps) => {
  const [loading, setLoading] = useState(true);
  const [creatorData, setCreatorData] = useState<CreatorData | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionCount>({ total: 0, thisMonth: 0 });
  const [copied, setCopied] = useState<"coupon" | "pix" | null>(null);

  useEffect(() => {
    if (open && userId) {
      fetchCreatorData();
    }
  }, [open, userId]);

  const fetchCreatorData = async () => {
    setLoading(true);
    try {
      // Fetch creator coupon data
      const { data: couponData, error: couponError } = await supabase
        .from("creator_coupons")
        .select("coupon_code, is_active, created_at, pix_key_type, pix_key")
        .eq("user_id", userId)
        .maybeSingle();

      if (couponError) throw couponError;
      setCreatorData(couponData);

      if (couponData) {
        // Fetch redemptions count
        const { data: redemptionsData } = await supabase
          .from("coupon_redemptions")
          .select("id, created_at")
          .eq("coupon_id", couponData.coupon_code);

        // We need to get the coupon id first
        const { data: couponIdData } = await supabase
          .from("creator_coupons")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (couponIdData) {
          const { data: allRedemptions } = await supabase
            .from("coupon_redemptions")
            .select("id, created_at")
            .eq("coupon_id", couponIdData.id);

          const now = new Date();
          const thisMonthRedemptions = (allRedemptions || []).filter((r) => {
            const date = new Date(r.created_at);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          });

          setRedemptions({
            total: allRedemptions?.length || 0,
            thisMonth: thisMonthRedemptions.length,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching creator data:", error);
      toast.error("Erro ao carregar dados do criador");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (value: string, type: "coupon" | "pix") => {
    navigator.clipboard.writeText(value);
    setCopied(type);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Detalhes do Criador
          </DialogTitle>
          <DialogDescription>
            Informações de {userName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !creatorData ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum dado de criador encontrado
          </div>
        ) : (
          <div className="space-y-6">
            {/* Coupon Info */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Cupom de Afiliado</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded-lg font-mono font-bold text-primary">
                  {creatorData.coupon_code}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(creatorData.coupon_code, "coupon")}
                >
                  {copied === "coupon" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={creatorData.is_active ? "default" : "secondary"}>
                  {creatorData.is_active ? "Ativo" : "Inativo"}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Criado em {format(new Date(creatorData.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{redemptions.total}</p>
                <p className="text-xs text-muted-foreground">Total de Resgates</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{redemptions.thisMonth}</p>
                <p className="text-xs text-muted-foreground">Este Mês</p>
              </div>
            </div>

            {/* PIX Info - Seção destacada para pagamento */}
            <div className="space-y-3 border-t pt-4">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-green-600" />
                Dados para Pagamento (PIX)
              </label>
              {creatorData.pix_key && creatorData.pix_key_type ? (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Tipo de Chave:</span>
                    <Badge className="bg-green-600 text-white">
                      {pixKeyTypeLabels[creatorData.pix_key_type] || creatorData.pix_key_type}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Chave PIX:</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background px-3 py-2 rounded-lg text-sm font-mono font-bold border">
                        {creatorData.pix_key}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => copyToClipboard(creatorData.pix_key!, "pix")}
                      >
                        {copied === "pix" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                  <Wallet className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Chave PIX não cadastrada
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O criador ainda não configurou uma chave PIX para recebimento
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreatorDetailsModal;