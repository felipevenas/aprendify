import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckSquare,
  FileText,
  Layers,
  PenLine,
  ClipboardList,
  Sparkles,
  Crown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ModuleCard {
  title: string;
  description: string;
  icon: typeof Calendar;
  path: string;
  isPremium?: boolean;
}

const primaryModules: ModuleCard[] = [
  {
    title: "Simulados",
    description: "Simule provas completas do ENEM",
    icon: ClipboardList,
    path: "/simulados",
    isPremium: true,
  },
  {
    title: "Correção de Redação",
    description: "Correção automática com IA",
    icon: PenLine,
    path: "/essays",
  },
  {
    title: "Plano de Estudos",
    description: "Organize suas sessões de estudo",
    icon: Calendar,
    path: "/schedule",
  },
  {
    title: "Desempenho",
    description: "Acompanhe sua evolução",
    icon: Sparkles,
    path: "/statistics",
    isPremium: true,
  },
];

const secondaryModules: ModuleCard[] = [
  {
    title: "Minhas Tarefas",
    description: "Gerencie suas atividades",
    icon: CheckSquare,
    path: "/tasks",
  },
  {
    title: "Anotações",
    description: "Organize por matéria",
    icon: FileText,
    path: "/notes",
  },
  {
    title: "Flashcards",
    description: "Memorize com cartões",
    icon: Layers,
    path: "/flashcards",
  },
];

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

/**
 * Grid de módulos com 4 cards principais e opção de expandir para ver mais
 */
const ModulesGrid = () => {
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const renderCard = (card: ModuleCard) => (
    <motion.div key={card.path} variants={itemVariants}>
      <Card
        className="group cursor-pointer border-border/50 overflow-hidden relative h-full bg-card hover:border-primary/30 transition-all duration-300"
        onClick={() => navigate(card.path)}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-accent/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <CardHeader className="relative pb-2">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
              <card.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            {card.isPremium && (
              <Badge variant="outline" className="px-1 py-0 text-[8px] sm:px-1.5 sm:py-0.5 sm:text-[10px] font-semibold border-primary/30 bg-primary/10 text-primary gap-0.5 sm:gap-1">
                <Crown className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                Premium
              </Badge>
            )}
          </div>
          <CardTitle className="text-base sm:text-lg group-hover:text-primary transition-colors duration-300">
            {card.title}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">{card.description}</CardDescription>
        </CardHeader>
        <CardContent className="relative pt-1 pb-4">
          <div className="flex items-center text-primary font-medium group-hover:gap-2 gap-1 transition-all duration-300 text-xs sm:text-sm">
            <span>Acessar</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">→</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-4">
      {/* Cards principais - 2x2 grid */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: { staggerChildren: 0.05 },
          },
        }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {primaryModules.map(renderCard)}
      </motion.div>

      {/* Botão Ver mais / Ver menos */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMore(!showMore)}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          {showMore ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Mais ferramentas
            </>
          )}
        </Button>
      </div>

      {/* Cards secundários - expandível */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: { staggerChildren: 0.05 },
                },
              }}
              className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
            >
              {secondaryModules.map(renderCard)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModulesGrid;
