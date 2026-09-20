import { useState } from "react";
import { Bug, Lightbulb, Wrench, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TicketType, FeedbackFormData } from "../types";

export const ticketTypeConfig = {
  suggestion: { label: "Sugestão", icon: Lightbulb, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  improvement: { label: "Melhoria", icon: Wrench, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  bug: { label: "Correção", icon: Bug, color: "bg-red-500/10 text-red-500 border-red-500/20" },
};

interface FeedbackFormProps {
  onSubmit: (data: FeedbackFormData) => Promise<boolean>;
  submitting: boolean;
}

export const FeedbackForm = ({ onSubmit, submitting }: FeedbackFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ticketType, setTicketType] = useState<TicketType>("suggestion");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit({ title, description, ticket_type: ticketType });
    if (success) {
      setTitle("");
      setDescription("");
      setTicketType("suggestion");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Nova solicitação</CardTitle>
        <CardDescription>
          Sua opinião é muito importante para melhorarmos a plataforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de solicitação</Label>
            <RadioGroup
              value={ticketType}
              onValueChange={(value) => setTicketType(value as TicketType)}
              className="flex flex-wrap gap-3"
            >
              {(Object.entries(ticketTypeConfig) as [TicketType, typeof ticketTypeConfig.suggestion][]).map(
                ([value, config]) => {
                  const Icon = config.icon;
                  return (
                    <div key={value}>
                      <RadioGroupItem value={value} id={value} className="peer sr-only" />
                      <Label
                        htmlFor={value}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                          ticketType === value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </Label>
                    </div>
                  );
                }
              )}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="Resumo da sua solicitação"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descreva em detalhes sua sugestão, melhoria ou problema encontrado..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px]"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar solicitação
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default FeedbackForm;
