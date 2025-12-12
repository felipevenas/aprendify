import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
}

/**
 * Full-page loader that ensures content only shows when fully loaded
 * Provides smooth fade transitions for better UX
 */
export const PageLoader = ({ loading, children, message = "Carregando..." }: PageLoaderProps) => {
  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5"
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-8 w-8 text-primary" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground text-sm"
            >
              {message}
            </motion.p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Inline content loader for sections within a page
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
