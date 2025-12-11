import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, BookOpen, Calculator, Beaker, Users, Globe, Loader2 } from "lucide-react";
import { useSimulados, SimuladoType } from "@/hooks/useSimulados";
import { toast } from "sonner";

interface NewSimuladoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog to create a new simulado
 * Allows user to choose between official exams and custom simulados
 */
export const NewSimuladoDialog = ({ open, onOpenChange }: NewSimuladoDialogProps) => {
  const navigate = useNavigate();
  const { createSimulado } = useSimulados();
  const [loading, setLoading] = useState(false);
  
  // Official exam state
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<"day1" | "day2">("day1");
  
  // Custom simulado state
  const [customType, setCustomType] = useState<SimuladoType>("custom_naturezas");
  const [questionCount, setQuestionCount] = useState<"45" | "90">("45");

  // Available years (2009-2024)
  const years = Array.from({ length: 16 }, (_, i) => String(2024 - i));

  /**
   * Handle starting an official exam
   */
  const handleStartOfficial = async () => {
    if (!selectedYear) {
      toast.error("Selecione um ano");
      return;
    }

    setLoading(true);
    try {
      const type = selectedDay === "day1" ? "official_day1" : "official_day2";
      const simuladoId = await createSimulado({
        type: type as SimuladoType,
        year: selectedYear,
        questionCount: 90
      });

      if (simuladoId) {
        onOpenChange(false);
        navigate(`/simulados/${simuladoId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle starting a custom simulado
   */
  const handleStartCustom = async () => {
    setLoading(true);
    try {
      const simuladoId = await createSimulado({
        type: customType,
        questionCount: parseInt(questionCount) as 45 | 90
      });

      if (simuladoId) {
        onOpenChange(false);
        navigate(`/simulados/${simuladoId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Custom type options with icons and descriptions
  const customOptions = [
    {
      type: "custom_naturezas" as SimuladoType,
      label: "Ciências da Natureza",
      description: "Física, Química e Biologia",
      icon: Beaker,
      color: "text-green-500"
    },
    {
      type: "custom_humanas" as SimuladoType,
      label: "Ciências Humanas",
      description: "História, Geografia, Filosofia e Sociologia",
      icon: Users,
      color: "text-blue-500"
    },
    {
      type: "custom_linguagens" as SimuladoType,
      label: "Linguagens",
      description: "Português, Literatura, Artes e Inglês/Espanhol",
      icon: Globe,
      color: "text-purple-500"
    },
    {
      type: "custom_matematica" as SimuladoType,
      label: "Matemática",
      description: "Todas as áreas de Matemática",
      icon: Calculator,
      color: "text-orange-500"
    },
    {
      type: "custom_mixed" as SimuladoType,
      label: "Simulado Misto",
      description: "Questões de todas as áreas aleatoriamente",
      icon: BookOpen,
      color: "text-primary"
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Simulado</DialogTitle>
          <DialogDescription>
            Escolha o tipo de simulado que deseja realizar
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="official" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="official">Prova Oficial</TabsTrigger>
            <TabsTrigger value="custom">Simulado Personalizado</TabsTrigger>
          </TabsList>

          {/* Official Exam Tab */}
          <TabsContent value="official" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Year Selection */}
              <div className="space-y-2">
                <Label>Ano da Prova</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        ENEM {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Day Selection */}
              <div className="space-y-2">
                <Label>Dia da Prova</Label>
                <RadioGroup 
                  value={selectedDay} 
                  onValueChange={(v) => setSelectedDay(v as "day1" | "day2")}
                  className="grid grid-cols-2 gap-4"
                >
                  <Card 
                    className={`cursor-pointer transition-all ${selectedDay === "day1" ? "border-primary ring-2 ring-primary/20" : ""}`}
                    onClick={() => setSelectedDay("day1")}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="day1" id="day1" />
                        <Label htmlFor="day1" className="cursor-pointer font-medium">
                          1º Dia
                        </Label>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Linguagens, Humanas e Redação
                      </p>
                      <Badge variant="secondary" className="mt-2">
                        <Clock className="h-3 w-3 mr-1" />
                        5h30
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card 
                    className={`cursor-pointer transition-all ${selectedDay === "day2" ? "border-primary ring-2 ring-primary/20" : ""}`}
                    onClick={() => setSelectedDay("day2")}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="day2" id="day2" />
                        <Label htmlFor="day2" className="cursor-pointer font-medium">
                          2º Dia
                        </Label>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Matemática e Naturezas
                      </p>
                      <Badge variant="secondary" className="mt-2">
                        <Clock className="h-3 w-3 mr-1" />
                        5h
                      </Badge>
                    </CardContent>
                  </Card>
                </RadioGroup>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <FileText className="h-4 w-4" />
                <span>90 questões • Prova completa oficial do ENEM {selectedYear || "..."}</span>
              </div>

              <Button 
                onClick={handleStartOfficial} 
                className="w-full" 
                disabled={!selectedYear || loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Iniciar Simulado Oficial
              </Button>
            </div>
          </TabsContent>

          {/* Custom Simulado Tab */}
          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Type Selection */}
              <div className="space-y-2">
                <Label>Área de Conhecimento</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Card
                        key={option.type}
                        className={`cursor-pointer transition-all ${customType === option.type ? "border-primary ring-2 ring-primary/20" : ""}`}
                        onClick={() => setCustomType(option.type)}
                      >
                        <CardContent className="flex items-start gap-3 p-4">
                          <Icon className={`h-5 w-5 mt-0.5 ${option.color}`} />
                          <div>
                            <p className="font-medium text-sm">{option.label}</p>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Question Count Selection */}
              <div className="space-y-2">
                <Label>Quantidade de Questões</Label>
                <RadioGroup 
                  value={questionCount} 
                  onValueChange={(v) => setQuestionCount(v as "45" | "90")}
                  className="grid grid-cols-2 gap-4"
                >
                  <Card 
                    className={`cursor-pointer transition-all ${questionCount === "45" ? "border-primary ring-2 ring-primary/20" : ""}`}
                    onClick={() => setQuestionCount("45")}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <RadioGroupItem value="45" id="q45" />
                      <div>
                        <Label htmlFor="q45" className="cursor-pointer font-medium">
                          45 Questões
                        </Label>
                        <p className="text-xs text-muted-foreground">Simulado rápido</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className={`cursor-pointer transition-all ${questionCount === "90" ? "border-primary ring-2 ring-primary/20" : ""}`}
                    onClick={() => setQuestionCount("90")}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <RadioGroupItem value="90" id="q90" />
                      <div>
                        <Label htmlFor="q90" className="cursor-pointer font-medium">
                          90 Questões
                        </Label>
                        <p className="text-xs text-muted-foreground">Simulado completo</p>
                      </div>
                    </CardContent>
                  </Card>
                </RadioGroup>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <Clock className="h-4 w-4" />
                <span>
                  {questionCount === "90" ? "5h" : "2h30"} • Questões de anos aleatórios (2009-2024)
                </span>
              </div>

              <Button 
                onClick={handleStartCustom} 
                className="w-full" 
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Iniciar Simulado Personalizado
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
