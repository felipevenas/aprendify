import { useState } from "react";
import { Sparkles, Loader2, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
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

interface GenerateScheduleButtonProps {
  onGenerated: () => void;
  lastGeneration?: {
    generated_at: string;
    next_regeneration_at: string;
  } | null;
}

const GenerateScheduleButton = ({ onGenerated, lastGeneration }: GenerateScheduleButtonProps) => {
  const [loading, setLoading] = useState(false);

  const canRegenerate = !lastGeneration || 
    new Date(lastGeneration.next_regeneration_at) <= new Date();

  const daysUntilRegeneration = lastGeneration
    ? Math.max(0, differenceInDays(new Date(lastGeneration.next_regeneration_at), new Date()))
    : 0;

  const handleGenerate = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-study-schedule");

      if (error) {
        console.error("Error generating schedule:", error);
        toast.error("Erro ao gerar cronograma. Tente novamente.");
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
      toast.error("Erro ao gerar cronograma");
    } finally {
      setLoading(false);
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
                O cronograma será regenerado antes do prazo de 15 dias. 
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

  // Botão principal para gerar cronograma
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
              cronograma personalizado de 15 dias.
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
