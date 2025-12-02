import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

/**
 * Componente de filtros para questões do ENEM
 * Permite selecionar ano, disciplina e idioma
 */
interface QuestionFiltersProps {
  selectedYear: string;
  selectedDiscipline: string;
  selectedLanguage: string;
  onYearChange: (year: string) => void;
  onDisciplineChange: (discipline: string) => void;
  onLanguageChange: (language: string) => void;
  onApply: () => void;
}

const QuestionFilters = ({
  selectedYear,
  selectedDiscipline,
  selectedLanguage,
  onYearChange,
  onDisciplineChange,
  onLanguageChange,
  onApply,
}: QuestionFiltersProps) => {
  // Anos disponíveis (2009-2024) + opção "Todos"
  const years = [
    { value: "all", label: "Todos os anos" },
    ...Array.from({ length: 16 }, (_, i) => ({ 
      value: (2024 - i).toString(), 
      label: `ENEM ${2024 - i}` 
    }))
  ];

  // Disciplinas do ENEM
  const disciplines = [
    { value: "all", label: "Todas as disciplinas" },
    { value: "linguagens", label: "Linguagens" },
    { value: "humanas", label: "Ciências Humanas" },
    { value: "natureza", label: "Ciências da Natureza" },
    { value: "matematica", label: "Matemática" },
  ];

  // Idiomas disponíveis
  const languages = [
    { value: "all", label: "Todos os idiomas" },
    { value: "ingles", label: "Inglês" },
    { value: "espanhol", label: "Espanhol" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Filtrar Questões</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Selecione os filtros desejados para personalizar sua prática
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Filtro de Ano */}
        <div className="space-y-2">
          <Label htmlFor="year" className="text-sm font-medium">
            Ano da Prova
          </Label>
          <Select value={selectedYear} onValueChange={onYearChange}>
            <SelectTrigger id="year" className="w-full">
              <SelectValue placeholder="Selecione o ano" />
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

        {/* Filtro de Disciplina */}
        <div className="space-y-2">
          <Label htmlFor="discipline" className="text-sm font-medium">
            Disciplina
          </Label>
          <Select value={selectedDiscipline} onValueChange={onDisciplineChange}>
            <SelectTrigger id="discipline" className="w-full">
              <SelectValue placeholder="Selecione a disciplina" />
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

        {/* Filtro de Idioma */}
        <div className="space-y-2">
          <Label htmlFor="language" className="text-sm font-medium">
            Idioma
          </Label>
          <Select value={selectedLanguage} onValueChange={onLanguageChange}>
            <SelectTrigger id="language" className="w-full">
              <SelectValue placeholder="Selecione o idioma" />
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
