import { useState, useRef } from "react";
import { Share2, Download, Twitter, Facebook, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ShareResultsButtonProps {
  percentage: number;
  totalCorrect: number;
  totalQuestions: number;
  disciplineStats: Record<string, { correct: number; incorrect: number; unanswered: number }>;
  simuladoType?: string;
}

/**
 * Button component to share simulado results to social media
 * Generates an optimized image of the performance
 */
export const ShareResultsButton = ({
  percentage,
  totalCorrect,
  totalQuestions,
  disciplineStats,
  simuladoType = "Simulado ENEM"
}: ShareResultsButtonProps) => {
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateShareImage = async (): Promise<Blob | null> => {
    setGenerating(true);
    
    try {
      // Create canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Set dimensions (optimized for social media - 1200x630 is ideal for OG)
      canvas.width = 1200;
      canvas.height = 630;

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#1a1a2e");
      gradient.addColorStop(1, "#16213e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Decorative circles
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#4f46e5";
      ctx.beginPath();
      ctx.arc(100, 100, 200, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(canvas.width - 100, canvas.height - 100, 250, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 42px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Meu Resultado no", canvas.width / 2, 80);
      
      ctx.fillStyle = "#818cf8";
      ctx.font = "bold 48px system-ui, -apple-system, sans-serif";
      ctx.fillText(simuladoType, canvas.width / 2, 135);

      // Main score circle
      const centerX = canvas.width / 2;
      const centerY = 320;
      const radius = 120;

      // Background circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(79, 70, 229, 0.2)";
      ctx.fill();

      // Progress arc
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (2 * Math.PI * percentage / 100);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.strokeStyle = percentage >= 70 ? "#22c55e" : percentage >= 50 ? "#eab308" : "#ef4444";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();

      // Percentage text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 72px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${percentage}%`, centerX, centerY - 10);
      
      ctx.font = "24px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText(`${totalCorrect}/${totalQuestions} acertos`, centerX, centerY + 45);

      // Discipline stats (show top 4)
      const disciplines = Object.entries(disciplineStats).slice(0, 4);
      const startX = 100;
      const barY = 500;
      const barWidth = (canvas.width - 200) / disciplines.length - 20;

      disciplines.forEach(([discipline, stats], index) => {
        const total = stats.correct + stats.incorrect + stats.unanswered;
        const perc = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
        const x = startX + index * (barWidth + 20);

        // Bar background
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(x, barY, barWidth, 20);

        // Bar fill
        ctx.fillStyle = perc >= 70 ? "#22c55e" : perc >= 50 ? "#eab308" : "#ef4444";
        ctx.fillRect(x, barY, (barWidth * perc) / 100, 20);

        // Label
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        const shortName = discipline.length > 15 ? discipline.substring(0, 12) + "..." : discipline;
        ctx.fillText(shortName, x + barWidth / 2, barY - 10);

        // Percentage
        ctx.fillStyle = "#a1a1aa";
        ctx.font = "12px system-ui, -apple-system, sans-serif";
        ctx.fillText(`${perc}%`, x + barWidth / 2, barY + 40);
      });

      // Watermark
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "18px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("aprendify.lovable.app", canvas.width / 2, canvas.height - 25);

      // Convert to blob with quality optimization
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob),
          "image/png",
          0.9
        );
      });
    } catch (error) {
      console.error("Error generating share image:", error);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const blob = await generateShareImage();
    if (!blob) {
      toast.error("Erro ao gerar imagem");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `resultado-simulado-${percentage}pct.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Imagem baixada com sucesso!");
  };

  const getShareText = () => {
    return `🎯 Acabei de fazer um ${simuladoType} e acertei ${percentage}% das questões (${totalCorrect}/${totalQuestions})! #ENEM #Estudos`;
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(getShareText());
    const url = encodeURIComponent("https://aprendify.lovable.app");
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const handleFacebookShare = () => {
    const url = encodeURIComponent("https://aprendify.lovable.app");
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(getShareText());
      setCopied(true);
      toast.success("Texto copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar texto");
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      toast.error("Compartilhamento não suportado neste navegador");
      return;
    }

    try {
      const blob = await generateShareImage();
      
      if (blob && navigator.canShare?.({ files: [new File([blob], "resultado.png", { type: "image/png" })] })) {
        const file = new File([blob], "resultado-simulado.png", { type: "image/png" });
        await navigator.share({
          title: "Meu Resultado no Simulado ENEM",
          text: getShareText(),
          files: [file]
        });
      } else {
        await navigator.share({
          title: "Meu Resultado no Simulado ENEM",
          text: getShareText(),
          url: "https://aprendify.lovable.app"
        });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing:", error);
      }
    }
  };

  // Check if native sharing is available
  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={generating}>
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          Compartilhar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {hasNativeShare && (
          <DropdownMenuItem onClick={handleNativeShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Baixar Imagem
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTwitterShare}>
          <Twitter className="h-4 w-4 mr-2" />
          Twitter / X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleFacebookShare}>
          <Facebook className="h-4 w-4 mr-2" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyText}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copiar Texto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
