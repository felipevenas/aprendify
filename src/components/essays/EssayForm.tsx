import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, AlertCircle, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

/**
 * Formulário para escrever e enviar redação para correção
 */
interface EssayFormProps {
  onComplete: () => void;
  canSubmit: boolean;
  isPremium: boolean;
}

const EssayForm = ({ onComplete, canSubmit, isPremium }: EssayFormProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  // Contagem de caracteres e palavras
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const minChars = 200;
  const recommendedWords = { min: 180, max: 350 };

  // Verificar se pode enviar
  const isValid = title.trim().length >= 5 && content.length >= minChars;

  // Enviar redação para correção
  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({
        title: "Limite atingido",
        description: isPremium 
          ? "Você já usou suas 4 correções deste mês." 
          : "Assine o Premium para corrigir mais redações.",
        variant: "destructive",
      });
      return;
    }

    if (!isValid) {
      toast({
        title: "Redação incompleta",
        description: "Verifique o título e o conteúdo da redação.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correct-essay`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ title, content }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao corrigir redação");
      }

      // Limpar formulário
      setTitle("");
      setContent("");
      
      onComplete();
    } catch (error: any) {
      console.error("Erro ao enviar redação:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível corrigir a redação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="p-6">
        {/* Alerta se não pode enviar */}
        {!canSubmit && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Você atingiu o limite de correções deste mês.
              </span>
              {!isPremium && (
                <Button size="sm" variant="outline" className="gap-1 ml-2">
                  <Crown className="h-3 w-3 text-yellow-500" />
                  Seja Premium
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Campo: Tema/Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Tema da Redação *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: O impacto das redes sociais na saúde mental dos jovens"
              disabled={loading || !canSubmit}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Digite o tema proposto para sua redação (mínimo 5 caracteres)
            </p>
          </div>

          {/* Campo: Conteúdo */}
          <div className="space-y-2">
            <Label htmlFor="content">Sua Redação *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva sua redação aqui... Lembre-se de estruturar em introdução, desenvolvimento e conclusão."
              disabled={loading || !canSubmit}
              className="min-h-[400px] font-mono text-sm leading-relaxed"
            />
            
            {/* Contadores */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex gap-4">
                <span className={charCount < minChars ? "text-destructive" : "text-muted-foreground"}>
                  {charCount} caracteres {charCount < minChars && `(mín. ${minChars})`}
                </span>
                <span className={
                  wordCount < recommendedWords.min ? "text-yellow-600" :
                  wordCount > recommendedWords.max ? "text-yellow-600" :
                  "text-green-600"
                }>
                  {wordCount} palavras 
                  {wordCount < recommendedWords.min && " (recomendado: mais)"}
                  {wordCount > recommendedWords.max && " (recomendado: menos)"}
                </span>
              </div>
              <span className="text-muted-foreground">
                Recomendado: {recommendedWords.min}-{recommendedWords.max} palavras
              </span>
            </div>
          </div>

          {/* Botão Enviar */}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!isValid || loading || !canSubmit}
              size="lg"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar para Correção
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default EssayForm;
