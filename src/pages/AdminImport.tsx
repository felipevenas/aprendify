import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, FileJson, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

const AdminImport = () => {
  const navigate = useNavigate();
  const [year, setYear] = useState("2024");
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/json") {
      setJsonFile(file);
      setResult(null);
    } else {
      toast.error("Por favor, selecione um arquivo JSON válido");
    }
  };

  const handleImport = async () => {
    if (!jsonFile) {
      toast.error("Selecione um arquivo JSON");
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      // Lê o arquivo JSON
      const text = await jsonFile.text();
      const json = JSON.parse(text);
      
      // Extrai as questões do JSON (suporta formato {data: [...]} ou [...])
      const questions = json.data || json;
      
      if (!Array.isArray(questions)) {
        throw new Error("Formato de JSON inválido. Esperado array de questões.");
      }

      console.log(`📤 Enviando ${questions.length} questões para importação...`);

      // Obtém o token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Você precisa estar logado");
      }

      // Chama a Edge Function
      const response = await supabase.functions.invoke('import-enem-questions', {
        body: { year, questions }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setResult(response.data);
      toast.success(`Importação concluída! ${response.data.inserted} questões importadas.`);
      
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(error.message || "Erro ao importar questões");
      setResult({ error: error.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Importar Questões ENEM</h1>
              <p className="text-muted-foreground">
                Área restrita para administradores
              </p>
            </div>
          </div>

          {/* Card de importação */}
          <Card className="p-6 space-y-6">
            {/* Ano */}
            <div className="space-y-2">
              <Label htmlFor="year">Ano da Prova</Label>
              <Input
                id="year"
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
              />
            </div>

            {/* Upload JSON */}
            <div className="space-y-2">
              <Label htmlFor="json">Arquivo JSON</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  id="json"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="json" className="cursor-pointer">
                  <FileJson className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  {jsonFile ? (
                    <p className="text-sm text-foreground font-medium">
                      {jsonFile.name}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar o arquivo JSON
                    </p>
                  )}
                </label>
              </div>
            </div>

            {/* Botão de importação */}
            <Button 
              onClick={handleImport} 
              disabled={!jsonFile || importing}
              className="w-full"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Questões
                </>
              )}
            </Button>

            {/* Resultado */}
            {result && (
              <div className={`p-4 rounded-lg ${result.error ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                {result.error ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <div>
                      <p className="font-medium text-destructive">Erro na importação</p>
                      <p className="text-sm text-muted-foreground">{result.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-500">Importação concluída!</p>
                      <p className="text-sm text-muted-foreground">
                        {result.inserted} de {result.total} questões importadas
                      </p>
                      {result.errors && result.errors.length > 0 && (
                        <p className="text-sm text-destructive mt-1">
                          {result.errors.length} erros encontrados
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Instruções */}
          <Card className="p-6 mt-6">
            <h3 className="font-semibold mb-3">Instruções</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>1. Certifique-se de que as imagens foram enviadas ao bucket <code className="bg-muted px-1 rounded">enem-images</code></li>
              <li>2. As imagens devem estar nomeadas como <code className="bg-muted px-1 rounded">question-1.png</code>, <code className="bg-muted px-1 rounded">question-2.png</code>, etc.</li>
              <li>3. Selecione o ano da prova e o arquivo JSON extraído</li>
              <li>4. Clique em "Importar Questões" e aguarde o processamento</li>
            </ul>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminImport;
