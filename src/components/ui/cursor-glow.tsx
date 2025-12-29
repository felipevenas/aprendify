import { useEffect, useState, useCallback } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";

interface CursorGlowProps {
  /**
   * Cor do glow (em formato HSL ou hex)
   */
  color?: string;
  /**
   * Tamanho do glow em pixels
   */
  size?: number;
  /**
   * Opacidade do glow (0-1)
   */
  opacity?: number;
  /**
   * Se o efeito está habilitado
   */
  enabled?: boolean;
}

/**
 * Componente que cria um efeito de glow sutil que segue o cursor
 * Adiciona profundidade e interatividade à página
 */
export const CursorGlow = ({
  color = "hsl(217, 91%, 50%)",
  size = 400,
  opacity = 0.08,
  enabled = true,
}: CursorGlowProps) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Motion values para posição suave do cursor
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Springs para movimento suave e orgânico
  const springConfig = { damping: 25, stiffness: 100, mass: 0.5 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
    if (!isVisible) setIsVisible(true);
  }, [mouseX, mouseY, isVisible]);

  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [enabled, handleMouseMove, handleMouseLeave]);

  if (!enabled) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          x: smoothX,
          y: smoothY,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          opacity,
        }}
      />
    </motion.div>
  );
};

export default CursorGlow;
