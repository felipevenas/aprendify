import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Wallet, Save, CheckCircle } from "lucide-react";

interface PixKeySectionProps {
  couponId: string;
  initialPixKeyType: string | null;
  initialPixKey: string | null;
  onUpdate?: () => void;
}

const pixKeyTypes = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

const PixKeySection = ({ couponId, initialPixKeyType, initialPixKey, onUpdate }: PixKeySectionProps) => {
  const [pixKeyType, setPixKeyType] = useState(initialPixKeyType || "");
  const [pixKey, setPixKey] = useState(initialPixKey || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const validatePixKey = (type: string, key: string): boolean => {
    const trimmedKey = key.trim();
    
    switch (type) {
      case "cpf":
        // CPF: 11 digits
        return /^\d{11}$/.test(trimmedKey.replace(/\D/g, ""));
      case "cnpj":
        // CNPJ: 14 digits
        return /^\d{14}$/.test(trimmedKey.replace(/\D/g, ""));
      case "email":
        // Email validation
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedKey);
      case "phone":
        // Phone: Brazilian format with area code
        return /^\d{10,11}$/.test(trimmedKey.replace(/\D/g, ""));
      case "random":
        // Random key: 32 characters UUID-like
        return trimmedKey.length >= 20 && trimmedKey.length <= 36;
      default:
        return false;
    }
  };

  const formatPixKey = (type: string, key: string): string => {
    const trimmedKey = key.trim();
    
    switch (type) {
      case "cpf":
      case "cnpj":
      case "phone":
        return trimmedKey.replace(/\D/g, "");
      default:
        return trimmedKey;
    }
  };

  const handleSave = async () => {
    if (!pixKeyType) {
      toast.error("Selecione o tipo de chave PIX");
      return;
    }

    if (!pixKey.trim()) {
      toast.error("Digite sua chave PIX");
      return;
    }

    if (!validatePixKey(pixKeyType, pixKey)) {
      toast.error("Chave PIX inválida para o tipo selecionado");
      return;
    }

    setSaving(true);
    try {
      const formattedKey = formatPixKey(pixKeyType, pixKey);
      
      const { error } = await supabase
        .from("creator_coupons")
        .update({
          pix_key_type: pixKeyType,
          pix_key: formattedKey,
        })
        .eq("id", couponId);

      if (error) throw error;

      setSaved(true);
      toast.success("Chave PIX salva com sucesso!");
      setTimeout(() => setSaved(false), 3000);
      onUpdate?.();
    } catch (error) {
      console.error("Error saving PIX key:", error);
      toast.error("Erro ao salvar chave PIX");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Dados para Pagamento
        </CardTitle>
        <CardDescription>
          Configure sua chave PIX para receber as comissões mensais das assinaturas geradas pelo seu cupom
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pixKeyType">Tipo de Chave</Label>
            <Select value={pixKeyType} onValueChange={setPixKeyType}>
              <SelectTrigger id="pixKeyType">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {pixKeyTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pixKey">Chave PIX</Label>
            <Input
              id="pixKey"
              placeholder={
                pixKeyType === "cpf"
                  ? "00000000000"
                  : pixKeyType === "cnpj"
                  ? "00000000000000"
                  : pixKeyType === "email"
                  ? "seu@email.com"
                  : pixKeyType === "phone"
                  ? "11999999999"
                  : "Sua chave aleatória"
              }
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Os pagamentos são realizados mensalmente via PIX
          </p>
          <Button onClick={handleSave} disabled={saving || !pixKeyType || !pixKey.trim()}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : saved ? (
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saved ? "Salvo!" : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PixKeySection;