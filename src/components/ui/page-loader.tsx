import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
}

/**
 * PageLoader suave e moderno (estilo YouTube/GitHub).
 * Não cobre a tela inteira com fundo opaco, permitindo que a estrutura (como a Sidebar e Topbar)
 * permaneça estática na tela sem piscar ao alternar de página.
 */
export const PageLoader = ({ loading, children, message = "Carregando..." }: PageLoaderProps) => {
  return (
    <div className="relative min-h-screen">
      {/* Linha de progresso no topo da tela */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="top-loading-bar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-dark to-accent z-[9999]"
          />
        )}
      </AnimatePresence>

      {/* Conteúdo principal com fade suave ao carregar */}
      <motion.div
        animate={{ opacity: loading ? 0.6 : 1 }}
        transition={{ duration: 0.3 }}
        className={loading ? "pointer-events-none select-none" : ""}
      >
        {children}
      </motion.div>

      {/* Overlay central flutuante e translúcido */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loader-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[1px] z-[9998] pointer-events-none"
          >
            <div className="flex flex-col items-center gap-3 bg-card/95 border border-border/50 px-6 py-4 rounded-2xl shadow-xl pointer-events-auto">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-muted-foreground text-xs font-semibold">{message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Inline content loader para seções específicas de uma página
 */
export const ContentLoader = ({ loading, children, className = "" }: { 
  loading: boolean; 
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`flex items-center justify-center py-8 ${className}`}
        >
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
