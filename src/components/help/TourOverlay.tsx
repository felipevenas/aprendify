import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHelpTooltips } from "@/contexts/HelpTooltipsContext";

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

/**
 * Overlay do tour com spotlight nos elementos
 * Usa posicionamento fixed baseado no viewport
 */
const TourOverlay = () => {
  const {
    showTooltips,
    tooltips,
    currentTooltipIndex,
    nextTooltip,
    prevTooltip,
    endTour,
    markTourAsSeen,
  } = useHelpTooltips();

  const [elementRect, setElementRect] = useState<ElementRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const currentTooltip = tooltips[currentTooltipIndex];

  // Atualiza a posição do elemento alvo
  const updatePosition = useCallback(() => {
    if (!currentTooltip) {
      setElementRect(null);
      return;
    }

    const element = document.querySelector(currentTooltip.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      
      setElementRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      });

      // Scroll suave para o elemento se não estiver visível
      const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!isInView) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      setElementRect(null);
    }
  }, [currentTooltip]);

  // Atualiza posição continuamente enquanto o tour está ativo
  useEffect(() => {
    if (!showTooltips || !currentTooltip) return;

    const animate = () => {
      updatePosition();
      rafRef.current = requestAnimationFrame(animate);
    };

    // Pequeno delay inicial para garantir que elementos estão renderizados
    const timer = setTimeout(() => {
      updatePosition();
      rafRef.current = requestAnimationFrame(animate);
    }, 150);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [showTooltips, currentTooltip, currentTooltipIndex, updatePosition]);

  const handleFinish = () => {
    markTourAsSeen();
    endTour();
  };

  const handleSkip = () => {
    markTourAsSeen();
    endTour();
  };

  if (!showTooltips || !currentTooltip) return null;

  const isLastStep = currentTooltipIndex === tooltips.length - 1;
  const isFirstStep = currentTooltipIndex === 0;

  // Calcula posição do card de tooltip
  const getTooltipCardStyle = (): React.CSSProperties => {
    if (!elementRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const cardWidth = 320;
    const cardHeight = 260;
    const padding = 16;
    const highlightPadding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Tenta posicionar abaixo do elemento
    let top = elementRect.bottom + highlightPadding + padding;
    let left = elementRect.left + elementRect.width / 2 - cardWidth / 2;

    // Se não couber abaixo, tenta acima
    if (top + cardHeight > viewportHeight - padding) {
      top = elementRect.top - highlightPadding - padding - cardHeight;
    }

    // Se não couber acima, posiciona ao lado
    if (top < padding) {
      top = Math.max(padding, elementRect.top);
      // Tenta à direita
      if (elementRect.right + padding + cardWidth < viewportWidth) {
        left = elementRect.right + highlightPadding + padding;
      } else {
        // Tenta à esquerda
        left = elementRect.left - highlightPadding - padding - cardWidth;
      }
    }

    // Mantém dentro dos limites horizontais
    if (left < padding) {
      left = padding;
    } else if (left + cardWidth > viewportWidth - padding) {
      left = viewportWidth - cardWidth - padding;
    }

    return {
      position: "fixed",
      top: `${Math.max(padding, top)}px`,
      left: `${left}px`,
    };
  };

  const highlightPadding = 8;

  return (
    <AnimatePresence>
      <motion.div
        key="tour-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999]"
        style={{ pointerEvents: "auto" }}
      >
        {/* Overlay escuro com recorte para o elemento destacado */}
        <div className="fixed inset-0" style={{ pointerEvents: "none" }}>
          <svg 
            className="w-full h-full"
            style={{ position: "fixed", inset: 0 }}
          >
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {elementRect && (
                  <rect
                    x={elementRect.left - highlightPadding}
                    y={elementRect.top - highlightPadding}
                    width={elementRect.width + highlightPadding * 2}
                    height={elementRect.height + highlightPadding * 2}
                    rx="12"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.8)"
              mask="url(#spotlight-mask)"
            />
          </svg>
        </div>

        {/* Borda de destaque ao redor do elemento */}
        {elementRect && (
          <motion.div
            key={`highlight-${currentTooltipIndex}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="fixed border-2 border-primary rounded-xl pointer-events-none"
            style={{
              top: elementRect.top - highlightPadding,
              left: elementRect.left - highlightPadding,
              width: elementRect.width + highlightPadding * 2,
              height: elementRect.height + highlightPadding * 2,
              boxShadow: "0 0 0 4px hsl(var(--primary) / 0.3), 0 0 30px hsl(var(--primary) / 0.4)",
            }}
          />
        )}

        {/* Card do tooltip */}
        <motion.div
          key={`tooltip-card-${currentTooltipIndex}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-card border border-border rounded-xl shadow-2xl p-5 w-80"
          style={getTooltipCardStyle()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {currentTooltipIndex + 1} de {tooltips.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2 -mt-2"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {currentTooltip.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {currentTooltip.description}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {tooltips.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentTooltipIndex
                    ? "w-4 bg-primary"
                    : idx < currentTooltipIndex
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevTooltip}
              disabled={isFirstStep}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              size="sm"
              onClick={isLastStep ? handleFinish : nextTooltip}
              className="flex-1"
            >
              {isLastStep ? (
                "Concluir"
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TourOverlay;
