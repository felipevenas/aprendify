import { useState } from "react";
import { Sparkles, Loader2, Calendar, RefreshCw, Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePremium } from "@/hooks/usePremium";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

interface GenerateScheduleButtonProps {
  onGenerated: () => void;
  lastGeneration?: {
    generated_at: string;
    next_regeneration_at: string;
  } | null;
}

const GenerateScheduleButton = ({ onGenerated, lastGeneration }: GenerateScheduleButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const navigate = useNavigate();

  const canRegenerate = !lastGeneration || 
    new Date(lastGeneration.next_regeneration_at) <= new Date();

  const daysUntilRegeneration = lastGeneration
    ? Math.max(0, differenceInDays(new Date(lastGeneration.next_regeneration_at), new Date()))
    : 0;

  const handleGenerate = async () => {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      const { data, error } = await supabase.functions.invoke("generate-study-schedule", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) {
        console.error("Error generating schedule:", error);
        const msg = (error as any)?.message || "Erro ao gerar cronograma. Tente novamente.";
        toast.error(msg);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Cronograma gerado com ${data.itemsCreated} sessões de estudo!`);
      onGenerated();
    } catch (error) {
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar cronograma");
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (!isPremium && !premiumLoading) {
      setPremiumDialogOpen(true);
      return;
    }
  };

  if (loading) {
    return (
      <Button disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Gerando cronograma...
      </Button>
    );
  }

  // Se não é premium, mostrar botão que abre modal de bloqueio
  if (!isPremium && !premiumLoading) {
    return (
      <Dialog open={premiumDialogOpen} onOpenChange={setPremiumDialogOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all relative">
            <Sparkles className="h-4 w-4" />
            Gerar Cronograma com IA
            <Lock className="h-3 w-3 absolute -top-1 -right-1 text-amber-500" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-2xl">Recurso Premium</DialogTitle>
            <DialogDescription className="text-base">
              A geração de cronograma com IA é exclusiva para assinantes Premium
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Cronograma Personalizado</h3>
                <p className="text-xs text-muted-foreground">IA analisa seu desempenho e cria um plano de estudos sob medida</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Atualização Automática</h3>
                <p className="text-xs text-muted-foreground">Cronograma se adapta ao seu progresso a cada 7 dias</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Foco nos Pontos Fracos</h3>
                <p className="text-xs text-muted-foreground">Prioriza disciplinas e tópicos onde você mais precisa melhorar</p>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            onClick={() => {
              setPremiumDialogOpen(false);
              navigate("/subscription");
            }}
          >
            <Crown className="h-5 w-5" />
            Assinar Premium
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Se ainda não pode regenerar, mostrar informação
  if (!canRegenerate && lastGeneration) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>
              Próxima atualização em {daysUntilRegeneration} {daysUntilRegeneration === 1 ? "dia" : "dias"}
            </span>
          </div>
          <p className="text-xs mt-0.5">
            Gerado em {format(new Date(lastGeneration.generated_at), "d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Forçar Regeneração
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerar cronograma agora?</AlertDialogTitle>
              <AlertDialogDescription>
                O cronograma será regenerado antes do prazo de 7 dias. 
                Isso irá substituir todas as sessões de estudo geradas pela IA.
                Sessões adicionadas manualmente serão mantidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleGenerate}>
                Regenerar Agora
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Botão principal para gerar cronograma (usuário premium)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all">
          <Sparkles className="h-4 w-4" />
          Gerar Cronograma com IA
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Cronograma Inteligente
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              A IA vai analisar seu desempenho nas questões e simulados para criar um 
              cronograma personalizado de 7 dias. Após completar os 7 dias, a IA gerará 
              automaticamente o próximo período com base no seu progresso.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
              <p className="font-medium text-foreground">O cronograma incluirá:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Tópicos específicos para cada disciplina</li>
                <li>Atividades práticas e exercícios</li>
                <li>Dicas de estudo personalizadas</li>
                <li>Priorização baseada nos seus pontos fracos</li>
              </ul>
            </div>
            <p className="text-amber-600 dark:text-amber-500 text-sm">
              ⚠️ Isso irá substituir sessões geradas anteriormente pela IA.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleGenerate} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Gerar Cronograma
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default GenerateScheduleButton;
