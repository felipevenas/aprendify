import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, BookOpen, Calculator, Beaker, Users, Loader2, Download } from "lucide-react";
import { useSimulados, SimuladoType } from "@/hooks/useSimulados";
import { useSimuladoPreparation, usePDFOnlyPreparation } from "@/hooks/useSimuladoPreparation";
import { SimuladoPreparationModal } from "@/components/simulados/SimuladoPreparationModal";
import { generateSimuladoPDF } from "@/lib/generateSimuladoPDF";
import { toast } from "sonner";

interface NewSimuladoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog to create a new simulado
 * Allows user to choose between official exams and custom simulados
 * Now includes preparation phase to ensure all questions are loaded
 */
export const NewSimuladoDialog = ({ open, onOpenChange }: NewSimuladoDialogProps) => {
  const navigate = useNavigate();
  const { createSimulado } = useSimulados();
  const {
    status: prepStatus,
    progress,
    message,
    error,
    loadedCount,
    targetCount,
    prepareSimulado,
    reset: resetPreparation,
  } = useSimuladoPreparation();

  const {
    status: pdfStatus,
    progress: pdfProgress,
    message: pdfMessage,
    error: pdfError,
    loadedCount: pdfLoadedCount,
    targetCount: pdfTargetCount,
    prepareForPDF,
    reset: resetPDFPreparation,
  } = usePDFOnlyPreparation();

  const [loading, setLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showPreparation, setShowPreparation] = useState(false);
  const [showPDFPreparation, setShowPDFPreparation] = useState(false);
  const [currentSimuladoId, setCurrentSimuladoId] = useState<string | null>(null);

  // Official exam state
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<"day1" | "day2">("day1");

  // Custom simulado state
  const [customType, setCustomType] = useState<SimuladoType>("custom_naturezas");
  const [questionCount, setQuestionCount] = useState<"45" | "90">("45");

  // Pending config for retry
  const [pendingConfig, setPendingConfig] = useState<{
    type: SimuladoType;
    year: string | null;
    questionCount: number;
  } | null>(null);

  // PDF config for retry
  const [pdfPendingConfig, setPDFPendingConfig] = useState<{
    type: SimuladoType;
    year: string | null;
    questionCount: number;
  } | null>(null);

  // Available years (2009-2025)
  const years = Array.from({ length: 17 }, (_, i) => String(2025 - i));

  /**
   * Start the preparation process
   */
  const startPreparation = async (type: SimuladoType, year: string | null, qCount: number) => {
    setLoading(true);
    setPendingConfig({ type, year, questionCount: qCount });

    try {
      // First, create the simulado record
      const simuladoId = await createSimulado({
        type,
        year: year || undefined,
        questionCount: qCount as 45 | 90,
      });

      if (!simuladoId) {
        toast.error("Erro ao criar simulado");
        setLoading(false);
        return;
      }

      setCurrentSimuladoId(simuladoId);
      setShowPreparation(true);
      setLoading(false);

      // Start preparation with retry mechanism
      const result = await prepareSimulado(simuladoId, type, year, qCount);

      if (result.success) {
        console.log(`[NewSimuladoDialog] Preparation complete with ${result.questions.length} questions`);
      }
    } catch (error) {
      console.error("[NewSimuladoDialog] Error:", error);
      toast.error("Erro ao iniciar simulado");
      setLoading(false);
    }
  };

  /**
   * Handle starting an official exam
   */
  const handleStartOfficial = async () => {
    if (!selectedYear) {
      toast.error("Selecione um ano");
      return;
    }

    const type = selectedDay === "day1" ? "official_day1" : "official_day2";
    await startPreparation(type as SimuladoType, selectedYear, 90);
  };

  /**
   * Handle starting a custom simulado
   */
  const handleStartCustom = async () => {
    await startPreparation(customType, null, parseInt(questionCount));
  };

  /**
   * Handle retry after error
   */
  const handleRetry = async () => {
    if (!pendingConfig || !currentSimuladoId) return;

    resetPreparation();

    // Delete the failed simulado answers and try again
    const result = await prepareSimulado(
      currentSimuladoId,
      pendingConfig.type,
      pendingConfig.year,
      pendingConfig.questionCount,
    );

    if (result.success) {
      console.log(`[NewSimuladoDialog] Retry successful with ${result.questions.length} questions`);
    }
  };

  /**
   * Handle cancel during preparation
   */
  const handleCancel = () => {
    setShowPreparation(false);
    resetPreparation();
    setCurrentSimuladoId(null);
    setPendingConfig(null);
  };

  /**
   * Handle continue to simulado
   */
  const handleContinue = () => {
    if (currentSimuladoId) {
      onOpenChange(false);
      setShowPreparation(false);
      resetPreparation();
      navigate(`/simulados/${currentSimuladoId}`);
    }
  };

  /**
   * Generate PDF Only (without starting simulado)
   */
  const handleGeneratePDFOnly = async (type: SimuladoType, year: string | null, qCount: number) => {
    setGeneratingPDF(true);
    setPDFPendingConfig({ type, year, questionCount: qCount });
    setShowPDFPreparation(true);

    try {
      const result = await prepareForPDF(type, year, qCount);

      if (result.success && result.questions.length > 0) {
        // Generate PDF
        const pdfQuestions = result.questions.map((q, index) => ({
          index: index + 1,
          title: q.title,
          context: q.context,
          alternatives: q.alternatives,
          discipline: q.discipline,
          year: q.year,
        }));

        await generateSimuladoPDF(pdfQuestions, type, year);
        toast.success("PDF gerado com sucesso!");
        setShowPDFPreparation(false);
        resetPDFPreparation();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("[PDF Generation] Error:", error);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handlePDFRetry = async () => {
    if (!pdfPendingConfig) return;

    resetPDFPreparation();
    await handleGeneratePDFOnly(pdfPendingConfig.type, pdfPendingConfig.year, pdfPendingConfig.questionCount);
  };

  const handlePDFCancel = () => {
    setShowPDFPreparation(false);
    resetPDFPreparation();
    setPDFPendingConfig(null);
    setGeneratingPDF(false);
  };

  const handlePDFComplete = () => {
    setShowPDFPreparation(false);
    resetPDFPreparation();
    onOpenChange(false);
  };

  const handleGenerateOfficialPDF = async () => {
    if (!selectedYear) {
      toast.error("Selecione um ano");
      return;
    }
    const type = selectedDay === "day1" ? "official_day1" : "official_day2";
    await handleGeneratePDFOnly(type as SimuladoType, selectedYear, 90);
  };

  const handleGenerateCustomPDF = async () => {
    await handleGeneratePDFOnly(customType, null, parseInt(questionCount));
  };

  // Custom type options with icons and descriptions
  const customOptions = [
    {
      type: "custom_naturezas" as SimuladoType,
      label: "Ciências da Natureza",
      description: "Física, Química e Biologia",
      icon: Beaker,
      color: "text-green-500",
    },
    {
      type: "custom_humanas" as SimuladoType,
      label: "Ciências Humanas",
      description: "História, Geografia, Filosofia e Sociologia",
      icon: Users,
      color: "text-blue-500",
    },
    {
      type: "custom_matematica" as SimuladoType,
      label: "Matemática",
      description: "Todas as áreas de Matemática",
      icon: Calculator,
      color: "text-orange-500",
    },
    {
      type: "custom_mixed" as SimuladoType,
      label: "Simulado Misto",
      description: "Questões de todas as áreas aleatoriamente",
      icon: BookOpen,
      color: "text-primary",
    },
  ];

  return (
    <>
      {/* Preparation Modal */}
      <SimuladoPreparationModal
        open={showPreparation}
        status={prepStatus}
        progress={progress}
        message={message}
        error={error}
        loadedCount={loadedCount}
        targetCount={targetCount}
        onRetry={handleRetry}
        onCancel={handleCancel}
        onContinue={handleContinue}
      />

      {/* PDF Preparation Modal */}
      <SimuladoPreparationModal
        open={showPDFPreparation}
        status={pdfStatus}
        progress={pdfProgress}
        message={pdfMessage || "Gerando PDF..."}
        error={pdfError}
        loadedCount={pdfLoadedCount}
        targetCount={pdfTargetCount}
        onRetry={handlePDFRetry}
        onCancel={handlePDFCancel}
        onContinue={handlePDFComplete}
        continueLabel="Fechar"
      />

      {/* Main Dialog */}
      <Dialog open={open && !showPreparation} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Simulado</DialogTitle>
            <DialogDescription>Escolha o tipo de simulado que deseja realizar</DialogDescription>
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
                      className={`cursor-pointer transition-all ${
                        selectedDay === "day1" ? "border-primary ring-2 ring-primary/20" : ""
                      }`}
                      onClick={() => setSelectedDay("day1")}
                    >
                      <div className="p-4">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="day1" id="day1" />
                          <Label htmlFor="day1" className="cursor-pointer font-medium">
                            1º Dia
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">Linguagens e Ciências Humanas</p>
                        <Badge variant="secondary" className="mt-2">
                          <Clock className="h-3 w-3 mr-1" />
                          5h30
                        </Badge>
                      </div>
                    </Card>

                    <Card
                      className={`cursor-pointer transition-all ${
                        selectedDay === "day2" ? "border-primary ring-2 ring-primary/20" : ""
                      }`}
                      onClick={() => setSelectedDay("day2")}
                    >
                      <div className="p-4">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="day2" id="day2" />
                          <Label htmlFor="day2" className="cursor-pointer font-medium">
                            2º Dia
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">Matemática e Naturezas</p>
                        <Badge variant="secondary" className="mt-2">
                          <Clock className="h-3 w-3 mr-1" />
                          5h
                        </Badge>
                      </div>
                    </Card>
                  </RadioGroup>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  <FileText className="h-4 w-4" />
                  <span>90 questões • Prova completa oficial do ENEM {selectedYear || "..."}</span>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleStartOfficial} className="flex-1" disabled={!selectedYear || loading || generatingPDF}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Iniciar Simulado
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleGenerateOfficialPDF} 
                    disabled={!selectedYear || loading || generatingPDF}
                    title="Gerar PDF para imprimir"
                  >
                    {generatingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                </div>
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
                          className={`cursor-pointer transition-all ${
                            customType === option.type ? "border-primary ring-2 ring-primary/20" : ""
                          }`}
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
                      className={`cursor-pointer transition-all ${
                        questionCount === "45" ? "border-primary ring-2 ring-primary/20" : ""
                      }`}
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
                      className={`cursor-pointer transition-all ${
                        questionCount === "90" ? "border-primary ring-2 ring-primary/20" : ""
                      }`}
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
                  <span>{questionCount === "90" ? "5h" : "2h30"} • Questões de anos aleatórios (2009-2025)</span>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleStartCustom} className="flex-1" disabled={loading || generatingPDF}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Iniciar Simulado
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleGenerateCustomPDF} 
                    disabled={loading || generatingPDF}
                    title="Gerar PDF para imprimir"
                  >
                    {generatingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};
