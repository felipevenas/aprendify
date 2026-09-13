import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, AlertCircle, Crown, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { studyActivityTracker } from "@/features/gamification/services/studyActivityTracker";
import { normalizeHttpFailure, readJsonSafely, RemoteFailure, retryAfterLabel } from "@/features/auth/services/remoteErrors";

/**
 * Formulário para escrever e enviar redação para correção
 */
interface EssayFormProps {
  onComplete: () => void;
  canSubmit: boolean;
  isPremium: boolean;
}

interface GeneratedTopic {
  titulo: string;
  textos_motivadores: string[];
  instrucao: string;
}

const EssayForm = ({ onComplete, canSubmit, isPremium }: EssayFormProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingTopic, setGeneratingTopic] = useState(false);
  const [generatedTopic, setGeneratedTopic] = useState<GeneratedTopic | null>(null);
  const [showTopicDetails, setShowTopicDetails] = useState(true);
  const [remoteError, setRemoteError] = useState<RemoteFailure | null>(null);
  const [failedAction, setFailedAction] = useState<"topic" | "submit" | null>(null);

  // Contagem de caracteres e palavras
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const minChars = 200;
  const recommendedWords = { min: 180, max: 350 };

  // Verificar se pode enviar
  const isValid = title.trim().length >= 5 && content.length >= minChars;

  // Gerar tema de redação com IA
  const handleGenerateTopic = async () => {
    setRemoteError(null);
    setFailedAction(null);
    setGeneratingTopic(true);
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-essay-topic`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await readJsonSafely(response) as GeneratedTopic & { error?: unknown } | null;

      if (!response.ok) {
        throw normalizeHttpFailure(response, { operation: "essay" });
      }

      setGeneratedTopic(data);
      setTitle(data.titulo);
      setShowTopicDetails(true);
      
      toast({
        title: "Tema gerado! 📝",
        description: "Leia os textos motivadores e comece sua redação.",
      });
    } catch (error) {
      const failure = error instanceof RemoteFailure ? error : new RemoteFailure(500, "Não foi possível concluir a solicitação. Tente novamente.", "server_error");
      setRemoteError(failure);
      setFailedAction("topic");
      toast({
        title: "Não foi possível gerar o tema",
        description: failure.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingTopic(false);
    }
  };

  // Enviar redação para correção
  const handleSubmit = async () => {
    setRemoteError(null);
    setFailedAction(null);
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

      const data = await readJsonSafely(response) as { error?: unknown } | null;

      if (!response.ok) {
        throw normalizeHttpFailure(response, { operation: "essay" });
      }

      // Registra no mapa de calor de estudo real
      if (session?.user?.id) {
        studyActivityTracker.recordAction(session.user.id, "essay");
      }

      // Limpar formulário
      setTitle("");
      setContent("");
      
      onComplete();
    } catch (error) {
      const failure = error instanceof RemoteFailure ? error : new RemoteFailure(500, "Não foi possível concluir a solicitação. Tente novamente.", "server_error");
      setRemoteError(failure);
      setFailedAction("submit");
      toast({
        title: "Não foi possível enviar a redação",
        description: failure.message,
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
      <Card className="p-6" aria-busy={loading || generatingTopic}>
        {remoteError && (
          <Alert variant="destructive" className="mb-6" role="alert" aria-live="assertive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p>{remoteError.message}</p>
              {retryAfterLabel(remoteError.retryAfterSeconds) && <p className="mt-1 text-xs">{retryAfterLabel(remoteError.retryAfterSeconds)}</p>}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => failedAction === "topic" ? void handleGenerateTopic() : void handleSubmit()}
                disabled={loading || generatingTopic}
              >
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}
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
            <div className="flex gap-2">
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (generatedTopic) setGeneratedTopic(null);
                }}
                placeholder="Ex: O impacto das redes sociais na saúde mental dos jovens"
                disabled={loading || !canSubmit}
                maxLength={200}
                name="essay-title"
                autoComplete="off"
                aria-describedby="essay-title-help"
                aria-invalid={title.length > 0 && title.trim().length < 5}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateTopic}
                disabled={loading || generatingTopic || !canSubmit}
                className="gap-2 shrink-0"
              >
                {generatingTopic ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Gerando...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Gerar Tema ENEM</span>
                  </>
                )}
              </Button>
            </div>
            <p id="essay-title-help" className="text-xs text-muted-foreground">
              Digite o tema ou clique em "Gerar Tema ENEM" para criar um tema no padrão oficial
            </p>
          </div>

          {/* Textos Motivadores (quando tema gerado) */}
          <AnimatePresence>
            {generatedTopic && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Collapsible open={showTopicDetails} onOpenChange={setShowTopicDetails}>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-4 text-left hover:bg-primary/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <Wand2 className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm text-foreground">
                            Textos Motivadores
                          </span>
                        </div>
                        {showTopicDetails ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-4">
                        {generatedTopic.textos_motivadores.map((texto, index) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Texto {index + 1}:</span>
                            <p className="mt-1 leading-relaxed">{texto}</p>
                          </div>
                        ))}
                        <div className="pt-3 border-t border-primary/10">
                          <p className="text-sm italic text-muted-foreground">
                            {generatedTopic.instrucao}
                          </p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Campo: Conteúdo */}
          <div className="space-y-2">
            <Label htmlFor="content">Sua Redação *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva sua redação aqui... Lembre-se de estruturar em introdução, desenvolvimento e conclusão."
              name="essay-content"
              maxLength={12000}
              aria-describedby="essay-content-help"
              aria-invalid={content.length > 0 && content.length < minChars}
              disabled={loading || !canSubmit}
              className="min-h-[400px] font-mono text-sm leading-relaxed"
            />
            
            {/* Contadores */}
            <div id="essay-content-help" className="flex flex-wrap items-center justify-between gap-2 text-xs" aria-live="polite">
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
