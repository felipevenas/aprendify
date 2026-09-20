import { motion } from "framer-motion";
import { Lock, CheckCircle2, Crown, Sparkles, Shield, Zap, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PremiumFeature {
  title: string;
  description: string;
}

interface PremiumLockScreenProps {
  title: string;
  description: string;
  features: PremiumFeature[];
}

export const PremiumLockScreen = ({ title, description, features }: PremiumLockScreenProps) => {
  const navigate = useNavigate();

  // Stats para prova social
  const stats = [
    { label: "Questões disponíveis", value: "15.000+" },
    { label: "Estudantes ativos", value: "2.500+" },
    { label: "Taxa de aprovação", value: "87%" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="text-center py-8 px-4"
    >
      {/* Animação do ícone de desbloqueio */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
        className="relative w-24 h-24 mx-auto mb-6"
      >
        {/* Círculo externo com gradiente animado */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600"
          animate={{ 
            boxShadow: [
              "0 0 20px rgba(251, 191, 36, 0.3)",
              "0 0 40px rgba(251, 191, 36, 0.5)",
              "0 0 20px rgba(251, 191, 36, 0.3)"
            ]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Ícone do cadeado com animação */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Lock className="w-12 h-12 text-white drop-shadow-lg" />
        </motion.div>
        
        {/* Partículas decorativas */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-amber-300 rounded-full"
            style={{
              top: `${20 + i * 25}%`,
              left: i % 2 === 0 ? "-10%" : "100%",
            }}
            animate={{
              y: [-10, 10, -10],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </motion.div>

      {/* Título e descrição */}
      <motion.h1 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent"
      >
        {title}
      </motion.h1>
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto"
      >
        {description}
      </motion.p>

      {/* Cards de estatísticas (prova social) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-3 sm:gap-4 max-w-md mx-auto mb-8"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className="text-center p-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30"
          >
            <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Card de features com preview borrado */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="max-w-2xl mx-auto mb-8 overflow-hidden relative">
          {/* Efeito de blur no background para simular conteúdo bloqueado */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80 pointer-events-none z-10" />
          
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Recursos Premium
              </span>
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            
            <div className="space-y-4 text-left">
              {features.map((feature, index) => (
                <motion.div 
                  key={index} 
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                >
                  <div className="mt-0.5 p-1 rounded-full bg-gradient-to-br from-green-400 to-green-600">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Garantia e CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="space-y-4"
      >
        {/* Badge de garantia */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 text-green-500" />
          <span>Garantia de 7 dias ou seu dinheiro de volta</span>
        </div>
        
        {/* Botão principal */}
        <Button
          size="xl"
          variant="premium"
          className="gap-2 shadow-lg shadow-amber-500/25"
          onClick={() => navigate("/settings?tab=subscription")}
        >
          <Crown className="h-5 w-5" />
          Assinar Premium
          <Zap className="h-4 w-4 ml-1" />
        </Button>

        {/* Badges de benefícios abaixo do botão */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span>Cancele quando quiser</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 text-blue-500" />
            <span>+2.500 estudantes</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PremiumLockScreen;
