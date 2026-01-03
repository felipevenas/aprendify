import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, FileJson, CheckCircle, AlertCircle, PenLine, CloudDownload, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import AddManualQuestionForm from "@/components/admin/AddManualQuestionForm";
import { Checkbox } from "@/components/ui/checkbox";

const AVAILABLE_YEARS = [
  "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", 
  "2014", "2013", "2012", "2011", "2010", "2009"
];

const AdminImport = () => {
  const navigate = useNavigate();
  const [year, setYear] = useState("2024");
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Estado para sincronização da API
  const [syncing, setSyncing] = useState(false);
  const [selectedYears, setSelectedYears] = useState<string[]>(["2023", "2022", "2021"]);
  const [syncResult, setSyncResult] = useState<any>(null);

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
      const text = await jsonFile.text();
      const json = JSON.parse(text);
      const questions = json.data || json;
      
      if (!Array.isArray(questions)) {
        throw new Error("Formato de JSON inválido. Esperado array de questões.");
      }

      console.log(`📤 Enviando ${questions.length} questões para importação...`);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Você precisa estar logado");
      }

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

  const handleSyncFromAPI = async () => {
    if (selectedYears.length === 0) {
      toast.error("Selecione pelo menos um ano");
      return;
    }

    setSyncing(true);
    setSyncResult(null);

    try {
      console.log(`🔄 Sincronizando anos: ${selectedYears.join(", ")}`);

      const response = await supabase.functions.invoke('sync-enem-questions', {
        body: { years: selectedYears }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setSyncResult(response.data);
      toast.success(`Sincronização concluída! ${response.data.totalInserted} questões importadas.`);
      
    } catch (error: any) {
      console.error("Erro na sincronização:", error);
      toast.error(error.message || "Erro ao sincronizar questões");
      setSyncResult({ error: error.message });
    } finally {
      setSyncing(false);
    }
  };

  const toggleYear = (year: string) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };

  const selectAllYears = () => {
    setSelectedYears(AVAILABLE_YEARS);
  };

  const clearSelection = () => {
    setSelectedYears([]);
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
              <h1 className="text-2xl font-bold">Gerenciar Questões ENEM</h1>
              <p className="text-muted-foreground">
                Adicione questões manualmente, importe via JSON ou sincronize da API
              </p>
            </div>
          </div>

          {/* Tabs para alternar entre métodos de adição */}
          <Tabs defaultValue="sync" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="sync" className="flex items-center gap-2">
                <CloudDownload className="h-4 w-4" />
                Sincronizar API
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <PenLine className="h-4 w-4" />
                Manual
              </TabsTrigger>
              <TabsTrigger value="json" className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                JSON
              </TabsTrigger>
            </TabsList>

            {/* Tab: Sincronização da API */}
            <TabsContent value="sync">
              <Card className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Selecione os anos para sincronizar</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllYears}>
                        Todos
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearSelection}>
                        Limpar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {AVAILABLE_YEARS.map((y) => (
                      <div
                        key={y}
                        className={`flex items-center justify-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedYears.includes(y)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/50 hover:bg-muted border-border'
                        }`}
                        onClick={() => toggleYear(y)}
                      >
                        <span className="text-sm font-medium">{y}</span>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {selectedYears.length} ano(s) selecionado(s)
                  </p>
                </div>

                <Button 
                  onClick={handleSyncFromAPI} 
                  disabled={selectedYears.length === 0 || syncing}
                  className="w-full"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <CloudDownload className="h-4 w-4 mr-2" />
                      Sincronizar Questões da API
                    </>
                  )}
                </Button>

                {/* Resultado da sincronização */}
                {syncResult && (
                  <div className={`p-4 rounded-lg ${syncResult.error ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                    {syncResult.error ? (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                        <div>
                          <p className="font-medium text-destructive">Erro na sincronização</p>
                          <p className="text-sm text-muted-foreground">{syncResult.error}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-green-500">Sincronização concluída!</p>
                          <p className="text-sm text-muted-foreground">
                            {syncResult.totalInserted} novas questões importadas
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {syncResult.totalSkipped} questões já existentes
                          </p>
                          {syncResult.totalErrors > 0 && (
                            <p className="text-sm text-destructive mt-1">
                              {syncResult.totalErrors} erros encontrados
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              <Card className="p-6 mt-6">
                <h3 className="font-semibold mb-3">Como funciona a sincronização</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>1. Selecione os anos que deseja importar (2009-2023)</li>
                  <li>2. O sistema busca as questões da API pública do ENEM</li>
                  <li>3. Questões novas são salvas com status <code className="bg-muted px-1 rounded">pending_classification</code></li>
                  <li>4. Após a sincronização, vá em <strong>Gerenciar Questões</strong> e clique em <strong>Classificar IA</strong></li>
                  <li>5. Questões classificadas com confiança ≥70% ficam disponíveis no Banco de Questões</li>
                </ul>
              </Card>
            </TabsContent>

            {/* Tab: Adição Manual */}
            <TabsContent value="manual">
              <AddManualQuestionForm />
            </TabsContent>

            {/* Tab: Importação via JSON */}
            <TabsContent value="json">
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

              {/* Instruções para JSON */}
              <Card className="p-6 mt-6">
                <h3 className="font-semibold mb-3">Instruções para Importação JSON</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>1. Certifique-se de que as imagens foram enviadas ao bucket <code className="bg-muted px-1 rounded">enem-images</code></li>
                  <li>2. As imagens devem estar nomeadas como <code className="bg-muted px-1 rounded">question-1.png</code>, <code className="bg-muted px-1 rounded">question-2.png</code>, etc.</li>
                  <li>3. Selecione o ano da prova e o arquivo JSON extraído</li>
                  <li>4. Clique em "Importar Questões" e aguarde o processamento</li>
                </ul>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminImport;
