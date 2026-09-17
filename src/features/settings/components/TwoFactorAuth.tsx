import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield, ShieldCheck, ShieldOff, Copy, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface TwoFactorAuthProps {
  userId: string;
}

/**
 * Componente de autenticação em dois fatores (2FA)
 * Permite que usuários ativem/desativem TOTP
 */
const TwoFactorAuth = ({ userId }: TwoFactorAuthProps) => {
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  
  // Estados para o fluxo de ativação
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Verifica se 2FA está ativado
  useEffect(() => {
    const checkMfaStatus = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        
        if (error) throw error;
        
        const totpFactor = data?.totp?.find(f => f.status === "verified");
        if (totpFactor) {
          setMfaEnabled(true);
          setFactorId(totpFactor.id);
        } else {
          setMfaEnabled(false);
          setFactorId(null);
        }
      } catch (error) {
        console.error("Erro ao verificar status 2FA:", error);
      } finally {
        setLoading(false);
      }
    };

    checkMfaStatus();
  }, []);

  // Inicia o processo de ativação do 2FA
  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Aprendify TOTP",
      });

      if (error) throw error;

      if (data?.totp) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setShowEnrollDialog(true);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar configuração do 2FA");
    } finally {
      setEnrolling(false);
    }
  };

  // Verifica o código e ativa o 2FA
  const handleVerify = async () => {
    if (!factorId || verificationCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }

    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) throw verifyError;

      setMfaEnabled(true);
      setShowEnrollDialog(false);
      setVerificationCode("");
      toast.success("Autenticação em dois fatores ativada com sucesso!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Código inválido. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  // Desativa o 2FA
  const handleUnenroll = async () => {
    if (!factorId) return;

    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (error) throw error;

      setMfaEnabled(false);
      setFactorId(null);
      toast.success("Autenticação em dois fatores desativada");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao desativar 2FA");
    } finally {
      setUnenrolling(false);
    }
  };

  // Copia o secret para a área de transferência
  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={mfaEnabled ? "border-green-500/30 bg-green-500/5" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Autenticação em Dois Fatores (2FA)
          </CardTitle>
          <CardDescription>
            Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <ShieldCheck className="h-8 w-8 text-green-500" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    2FA está ativado
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sua conta está protegida com autenticação em dois fatores
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={handleUnenroll}
                disabled={unenrolling}
                className="w-full sm:w-auto"
              >
                {unenrolling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4 mr-2" />
                )}
                Desativar 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <ShieldOff className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">2FA não está ativado</p>
                  <p className="text-sm text-muted-foreground">
                    Recomendamos ativar para maior segurança
                  </p>
                </div>
              </div>
              <Button
                onClick={handleEnroll}
                disabled={enrolling}
                className="w-full sm:w-auto"
              >
                {enrolling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Ativar 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de configuração do 2FA */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Configurar Autenticação em Dois Fatores
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu aplicativo autenticador (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* QR Code */}
            <div className="flex justify-center">
              {qrCode && (
                <div className="p-4 bg-white rounded-lg">
                  <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
                </div>
              )}
            </div>

            {/* Código manual */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Ou digite o código manualmente:
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                  {secret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                  className="shrink-0"
                >
                  {copiedSecret ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Campo de verificação */}
            <div className="space-y-2">
              <Label htmlFor="verification-code">
                Digite o código de 6 dígitos do app:
              </Label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEnrollDialog(false);
                setVerificationCode("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleVerify}
              disabled={verifying || verificationCode.length !== 6}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Verificar e Ativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TwoFactorAuth;
