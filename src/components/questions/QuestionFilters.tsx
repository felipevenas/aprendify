import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Componente de filtros para questões do ENEM
 * Inspirado em layout de concorrentes, adaptado para ENEM
 */
interface QuestionFiltersProps {
  selectedYear: string;
  selectedDiscipline: string;
  selectedLanguage: string;
  selectedDifficulty: string;
  selectedTopic: string;
  selectedStatus: string;
  searchKeyword: string;
  onYearChange: (year: string) => void;
  onDisciplineChange: (discipline: string) => void;
  onLanguageChange: (language: string) => void;
  onDifficultyChange: (difficulty: string) => void;
  onTopicChange: (topic: string) => void;
  onStatusChange: (status: string) => void;
  onSearchChange: (keyword: string) => void;
  onApply: () => void;
}

const QuestionFilters = ({
  selectedYear,
  selectedDiscipline,
  selectedLanguage,
  selectedDifficulty,
  selectedTopic,
  selectedStatus,
  searchKeyword,
  onYearChange,
  onDisciplineChange,
  onLanguageChange,
  onDifficultyChange,
  onTopicChange,
  onStatusChange,
  onSearchChange,
  onApply,
}: QuestionFiltersProps) => {
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // Anos disponíveis (2009-2025) + opção "Todos"
  const years = [
    { value: "all", label: "Todos os anos" },
    ...Array.from({ length: 17 }, (_, i) => ({ 
      value: (2025 - i).toString(), 
      label: `ENEM ${2025 - i}` 
    }))
  ];

  // Disciplinas do ENEM
  const disciplines = [
    { value: "all", label: "Todas as disciplinas" },
    { value: "linguagens", label: "Linguagens" },
    { value: "ciencias-humanas", label: "Ciências Humanas" },
    { value: "ciencias-natureza", label: "Ciências da Natureza" },
    { value: "matematica", label: "Matemática" },
  ];

  // Idiomas disponíveis
  const languages = [
    { value: "all", label: "Todos os idiomas" },
    { value: "ingles", label: "Inglês" },
    { value: "espanhol", label: "Espanhol" },
  ];

  // Níveis de dificuldade
  const difficulties = [
    { value: "all", label: "Todas" },
    { value: "easy", label: "Fácil" },
    { value: "medium", label: "Médio" },
    { value: "hard", label: "Difícil" },
  ];

  // Status das questões
  const statusOptions = [
    { value: "all", label: "Todas" },
    { value: "unanswered", label: "Não Resolvidas" },
    { value: "answered", label: "Resolvidas" },
    { value: "correct", label: "Acertei" },
    { value: "incorrect", label: "Errei" },
  ];

  // Carrega tópicos quando a disciplina muda
  useEffect(() => {
    const loadTopics = async () => {
      if (selectedDiscipline === "all") {
        setAvailableTopics([]);
        onTopicChange("all");
        return;
      }

      setLoadingTopics(true);
      try {
        // Busca tópicos distintos da disciplina selecionada
        const { data, error } = await supabase
          .from('enem_questions')
          .select('main_topic')
          .eq('discipline', selectedDiscipline)
          .eq('is_active', true)
          .not('main_topic', 'is', null)
          .order('main_topic');

        if (error) {
          console.error("Erro ao carregar tópicos:", error);
          setAvailableTopics([]);
          return;
        }

        // Filtra valores únicos
        const uniqueTopics = [...new Set(data?.map(q => q.main_topic).filter(Boolean))] as string[];
        setAvailableTopics(uniqueTopics);
        
        // Reseta tópico se não existir na nova lista
        if (selectedTopic !== "all" && !uniqueTopics.includes(selectedTopic)) {
          onTopicChange("all");
        }
      } catch (error) {
        console.error("Erro ao carregar tópicos:", error);
        setAvailableTopics([]);
      } finally {
        setLoadingTopics(false);
      }
    };

    loadTopics();
  }, [selectedDiscipline]);

  // Handler para mudança de disciplina
  const handleDisciplineChange = (value: string) => {
    onDisciplineChange(value);
    // Reseta tópico quando disciplina muda
    if (value === "all") {
      onTopicChange("all");
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Toggle Buttons */}
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((status) => (
          <Button
            key={status.value}
            variant={selectedStatus === status.value ? "default" : "outline"}
            size="sm"
            onClick={() => onStatusChange(status.value)}
            className="rounded-full"
          >
            {status.label}
          </Button>
        ))}
      </div>

      {/* Busca por palavra-chave */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Faça uma busca por palavra chave"
          value={searchKeyword}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filtros principais */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Filtros mais usados</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filtro de Disciplina */}
          <div className="space-y-2">
            <Label htmlFor="discipline" className="text-sm font-medium">
              Disciplina
            </Label>
            <Select value={selectedDiscipline} onValueChange={handleDisciplineChange}>
              <SelectTrigger id="discipline" className="w-full">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                {disciplines.map((discipline) => (
                  <SelectItem key={discipline.value} value={discipline.value}>
                    {discipline.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Assunto (dependente da disciplina) */}
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-sm font-medium">
              Assunto
            </Label>
            <Select 
              value={selectedTopic} 
              onValueChange={onTopicChange}
              disabled={selectedDiscipline === "all" || loadingTopics}
            >
              <SelectTrigger id="topic" className="w-full">
                <SelectValue placeholder={
                  selectedDiscipline === "all" 
                    ? "Selecione uma disciplina" 
                    : loadingTopics 
                      ? "Carregando..." 
                      : "Todos os assuntos"
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os assuntos</SelectItem>
                {availableTopics.map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Idioma */}
          <div className="space-y-2">
            <Label htmlFor="language" className="text-sm font-medium">
              Idioma
            </Label>
            <Select value={selectedLanguage} onValueChange={onLanguageChange}>
              <SelectTrigger id="language" className="w-full">
                <SelectValue placeholder="Idioma" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((language) => (
                  <SelectItem key={language.value} value={language.value}>
                    {language.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Ano */}
          <div className="space-y-2">
            <Label htmlFor="year" className="text-sm font-medium">
              Ano
            </Label>
            <Select value={selectedYear} onValueChange={onYearChange}>
              <SelectTrigger id="year" className="w-full">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Filtros avançados */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Filtros avançados</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filtro de Dificuldade */}
          <div className="space-y-2">
            <Label htmlFor="difficulty" className="text-sm font-medium">
              Dificuldade
            </Label>
            <Select value={selectedDifficulty} onValueChange={onDifficultyChange}>
              <SelectTrigger id="difficulty" className="w-full">
                <SelectValue placeholder="Dificuldade" />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map((difficulty) => (
                  <SelectItem key={difficulty.value} value={difficulty.value}>
                    {difficulty.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Botão de aplicar */}
      <div className="flex justify-end pt-2">
        <Button onClick={onApply} className="gap-2">
          <Check className="h-4 w-4" />
          Aplicar Filtros
        </Button>
      </div>
    </div>
  );
};

export default QuestionFilters;
