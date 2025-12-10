import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Crown, 
  Sparkles, 
  Brain, 
  FileText, 
  BarChart3, 
  Infinity, 
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import Confetti from "react-confetti";
import { useWindowSize } from "@/hooks/useWindowSize";

const benefits = [
  {
    icon: Brain,
    title: "Explicações com IA",
    description: "Explicações detalhadas para todas as questões do ENEM"
  },
  {
    icon: FileText,
    title: "12 Correções de Redação/mês",
    description: "Correções completas seguindo os critérios do ENEM"
  },
  {
    icon: BarChart3,
    title: "Estatísticas Completas",
    description: "Análise detalhada do seu desempenho por disciplina"
  },
  {
    icon: Infinity,
    title: "Questões Ilimitadas",
    description: "Pratique quantas questões quiser, sem limites diários"
  },
  {
    icon: Sparkles,
    title: "Flashcards Ilimitados",
    description: "Crie quantos flashcards precisar para seus estudos"
  },
  {
    icon: Crown,
    title: "Acesso Prioritário",
    description: "Seja o primeiro a acessar novas funcionalidades"
  }
];

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.1}
        />
      )}
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        <Card className="border-primary/20 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary/80 p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4"
            >
              <Crown className="w-10 h-10 text-white" />
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl md:text-4xl font-bold text-white mb-2"
            >
              Bem-vindo ao Premium!
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-white/90 text-lg"
            >
              Sua assinatura foi ativada com sucesso
            </motion.p>
          </div>
          
          <CardContent className="p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-center mb-8"
            >
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Seus novos benefícios
              </h2>
              <p className="text-muted-foreground">
                Aproveite ao máximo sua experiência de estudos
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <benefit.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{benefit.title}</h3>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 }}
              className="text-center space-y-4"
            >
              <p className="text-muted-foreground">
                Você já pode começar a usar todos os recursos premium agora mesmo!
              </p>
              
              <Button 
                size="lg" 
                onClick={() => navigate("/dashboard")}
                className="gap-2"
              >
                Retornar para o Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
