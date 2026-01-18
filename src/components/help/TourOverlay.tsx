import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHelpTooltips } from "@/contexts/HelpTooltipsContext";

interface TooltipPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Overlay do tour com spotlight nos elementos
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

  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const currentTooltip = tooltips[currentTooltipIndex];

  // Scroll to and highlight the target element
  const updatePosition = useCallback(() => {
    if (!currentTooltip) return;

    const element = document.querySelector(currentTooltip.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

      setPosition({
        top: rect.top + scrollTop,
        left: rect.left + scrollLeft,
        width: rect.width,
        height: rect.height,
      });

      // Scroll element into view with offset
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setPosition(null);
    }
  }, [currentTooltip]);

  useEffect(() => {
    if (showTooltips && currentTooltip) {
      // Small delay to allow any animations to complete
      const timer = setTimeout(updatePosition, 100);
      return () => clearTimeout(timer);
    }
  }, [showTooltips, currentTooltip, currentTooltipIndex, updatePosition]);

  // Update position on resize
  useEffect(() => {
    if (!showTooltips) return;

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [showTooltips, updatePosition]);

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

  // Calculate tooltip card position
  const getTooltipCardStyle = () => {
    if (!position) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const cardWidth = 320;
    const cardHeight = 200;
    const padding = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Try to position below the element first
    let top = position.top + position.height + padding;
    let left = position.left + position.width / 2 - cardWidth / 2;

    // If below goes off screen, try above
    if (top + cardHeight > viewportHeight + window.scrollY) {
      top = position.top - cardHeight - padding;
    }

    // Keep within horizontal bounds
    if (left < padding) {
      left = padding;
    } else if (left + cardWidth > viewportWidth - padding) {
      left = viewportWidth - cardWidth - padding;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
      >
        {/* Dark overlay with cutout for highlighted element */}
        <svg className="absolute inset-0 w-full h-full" style={{ height: document.documentElement.scrollHeight }}>
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {position && (
                <rect
                  x={position.left - 8}
                  y={position.top - 8}
                  width={position.width + 16}
                  height={position.height + 16}
                  rx="8"
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
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Highlight border around element */}
        {position && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute border-2 border-primary rounded-lg pointer-events-none"
            style={{
              top: position.top - 8,
              left: position.left - 8,
              width: position.width + 16,
              height: position.height + 16,
              boxShadow: "0 0 0 4px rgba(var(--primary), 0.3), 0 0 20px rgba(var(--primary), 0.4)",
            }}
          />
        )}

        {/* Tooltip card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bg-card border border-border rounded-xl shadow-2xl p-5 w-80 z-10"
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
