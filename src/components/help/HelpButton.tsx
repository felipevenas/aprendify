import { HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHelpTooltips } from "@/contexts/HelpTooltipsContext";

/**
 * Botão flutuante de ajuda (?)
 * Aparece no canto inferior direito e ativa o tour de tooltips
 */
const HelpButton = () => {
  const { startTour, showTooltips } = useHelpTooltips();

  return (
    <AnimatePresence>
      {!showTooltips && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={startTour}
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-110"
                >
                  <HelpCircle className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="font-medium">
                <p>Precisa de ajuda? Clique para ver o tour</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HelpButton;
