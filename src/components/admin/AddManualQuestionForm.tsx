import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, CheckCircle, AlertCircle, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

// Disciplinas disponíveis no ENEM
const DISCIPLINES = [
  { value: "linguagens", label: "Linguagens" },
  { value: "ciencias-humanas", label: "Ciências Humanas" },
  { value: "ciencias-natureza", label: "Ciências da Natureza" },
  { value: "matematica", label: "Matemática" },
];

// Alternativas padrão
const ALTERNATIVES_KEYS = ["A", "B", "C", "D", "E"];

interface AddManualQuestionFormProps {
  onSuccess?: () => void;
}

/**
 * Formulário para adicionar questões ENEM manualmente
 * Permite que administradores insiram questões individuais
 */
const AddManualQuestionForm = ({ onSuccess }: AddManualQuestionFormProps) => {
  // Estado do formulário
  const [year, setYear] = useState("2024");
  const [discipline, setDiscipline] = useState("");
  const [questionIndex, setQuestionIndex] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [alternativesIntro, setAlternativesIntro] = useState("");
  const [alternatives, setAlternatives] = useState<Record<string, string>>({
    A: "",
    B: "",
    C: "",
    D: "",
    E: "",
  });
  const [correctAlternative, setCorrectAlternative] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  /**
   * Manipula seleção de imagem
   */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validação de tipo de arquivo
      if (!file.type.startsWith("image/")) {
        toast.error("Por favor, selecione apenas arquivos de imagem");
        return;
      }
      // Validação de tamanho (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Imagem muito grande. Máximo 5MB.");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  /**
   * Remove imagem selecionada
   */
  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  /**
   * Atualiza valor de uma alternativa específica
   */
  const handleAlternativeChange = (key: string, value: string) => {
    setAlternatives((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Reseta o formulário para valores iniciais
   */
  const resetForm = () => {
    setYear("2024");
    setDiscipline("");
    setQuestionIndex("");
    setTitle("");
    setContext("");
    setAlternativesIntro("");
    setAlternatives({ A: "", B: "", C: "", D: "", E: "" });
    setCorrectAlternative("");
    removeImage();
    setResult(null);
  };

  /**
   * Valida os campos obrigatórios do formulário
   */
  const validateForm = (): string | null => {
    if (!year.trim()) return "Informe o ano da prova";
    if (!discipline) return "Selecione a disciplina";
    if (!questionIndex.trim()) return "Informe o número da questão";
    if (!title.trim()) return "Informe o enunciado da questão";
    if (!correctAlternative) return "Selecione a alternativa correta";
    
    // Verifica se todas as alternativas têm conteúdo
    for (const key of ALTERNATIVES_KEYS) {
      if (!alternatives[key].trim()) {
        return `Preencha a alternativa ${key}`;
      }
    }
    
    return null;
  };

  /**
   * Envia a questão para o banco de dados
   */
  const handleSubmit = async () => {
    // Validação
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    setResult(null);

    try {
      let imageUrl: string | null = null;

      // Upload da imagem se existir
      if (imageFile) {
        const fileName = `question-${year}-${questionIndex}-${Date.now()}.${imageFile.name.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("enem-images")
          .upload(fileName, imageFile);

        if (uploadError) {
          throw new Error(`Erro ao fazer upload da imagem: ${uploadError.message}`);
        }

        // Obtém URL pública da imagem
        const { data: publicUrl } = supabase.storage
          .from("enem-images")
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl.publicUrl;
      }

      // Monta o objeto de alternativas no formato esperado pelo banco
      const alternativesArray = ALTERNATIVES_KEYS.map((key) => ({
        letter: key,
        text: alternatives[key],
      }));

      // Insere a questão no banco de dados
      const { error: insertError } = await supabase
        .from("enem_questions")
        .insert({
          year,
          discipline,
          index: parseInt(questionIndex),
          title,
          context: context.trim() || null,
          alternatives_introduction: alternativesIntro.trim() || null,
          alternatives: alternativesArray,
          correct_alternative: correctAlternative,
          files: imageUrl ? [imageUrl] : null,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setResult({ success: true });
      toast.success("Questão adicionada com sucesso!");
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao adicionar questão:", error);
      setResult({ error: error.message });
      toast.error(error.message || "Erro ao adicionar questão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <h3 className="text-lg font-semibold">Adicionar Questão Manualmente</h3>

      {/* Linha 1: Ano, Disciplina, Número */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="manual-year">Ano da Prova</Label>
          <Input
            id="manual-year"
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2024"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-discipline">Disciplina</Label>
          <Select value={discipline} onValueChange={setDiscipline}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {DISCIPLINES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-index">Número da Questão</Label>
          <Input
            id="manual-index"
            type="number"
            value={questionIndex}
            onChange={(e) => setQuestionIndex(e.target.value)}
            placeholder="1"
            min="1"
          />
        </div>
      </div>

      {/* Enunciado */}
      <div className="space-y-2">
        <Label htmlFor="manual-title">Enunciado da Questão *</Label>
        <Textarea
          id="manual-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Digite o enunciado completo da questão..."
          rows={4}
        />
      </div>

      {/* Contexto (opcional) */}
      <div className="space-y-2">
        <Label htmlFor="manual-context">Texto de Apoio / Contexto (opcional)</Label>
        <Textarea
          id="manual-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Texto, citação ou contexto que acompanha a questão..."
          rows={3}
        />
      </div>

      {/* Imagem (opcional) */}
      <div className="space-y-2">
        <Label>Imagem (opcional)</Label>
        <div className="border-2 border-dashed border-border rounded-lg p-4">
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 mx-auto rounded-md"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label htmlFor="manual-image" className="cursor-pointer flex flex-col items-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                Clique para selecionar uma imagem
              </span>
              <input
                id="manual-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Introdução das alternativas (opcional) */}
      <div className="space-y-2">
        <Label htmlFor="manual-alt-intro">Introdução das Alternativas (opcional)</Label>
        <Input
          id="manual-alt-intro"
          value={alternativesIntro}
          onChange={(e) => setAlternativesIntro(e.target.value)}
          placeholder='Ex: "De acordo com o texto, é correto afirmar que:"'
        />
      </div>

      {/* Alternativas */}
      <div className="space-y-3">
        <Label>Alternativas *</Label>
        {ALTERNATIVES_KEYS.map((key) => (
          <div key={key} className="flex items-start gap-3">
            <span className="font-semibold text-primary mt-2 w-6">{key})</span>
            <Textarea
              value={alternatives[key]}
              onChange={(e) => handleAlternativeChange(key, e.target.value)}
              placeholder={`Texto da alternativa ${key}...`}
              rows={2}
              className="flex-1"
            />
          </div>
        ))}
      </div>

      {/* Alternativa Correta */}
      <div className="space-y-2">
        <Label htmlFor="manual-correct">Alternativa Correta *</Label>
        <Select value={correctAlternative} onValueChange={setCorrectAlternative}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {ALTERNATIVES_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Botões de ação */}
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={saving} className="flex-1">
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
              Salvando...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Questão
            </>
          )}
        </Button>
        <Button variant="outline" onClick={resetForm} disabled={saving}>
          Limpar
        </Button>
      </div>

      {/* Resultado */}
      {result && (
        <div
          className={`p-4 rounded-lg ${
            result.error ? "bg-destructive/10" : "bg-green-500/10"
          }`}
        >
          {result.error ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">Erro ao adicionar</p>
                <p className="text-sm text-muted-foreground">{result.error}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="font-medium text-green-500">Questão adicionada com sucesso!</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default AddManualQuestionForm;
