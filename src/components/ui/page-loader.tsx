import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "./skeleton";
import { DashboardSkeleton, CardGridSkeleton, ListSkeleton } from "./page-skeletons";

interface PageLoaderProps {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
  variant?: "dashboard" | "cards" | "list" | "default";
}

/**
 * PageLoader profissional baseado 100% em Skeleton Loading.
 * Elimina completamente os spinners giratórios intrusivos.
 * Exibe transições suaves com shimmer e preserva a estrutura da página.
 */
export const PageLoader = ({ 
  loading, 
  children, 
  variant = "default" 
}: PageLoaderProps) => {
  return (
    <div className="relative w-full">


      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {variant === "dashboard" ? (
              <DashboardSkeleton />
            ) : variant === "cards" ? (
              <CardGridSkeleton />
            ) : variant === "list" ? (
              <ListSkeleton />
            ) : (
              /* Skeleton genérico padrão para páginas */
              <div className="space-y-6 w-full animate-fade-in">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/40">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-56 rounded-xl" />
                    <Skeleton className="h-4 w-80 max-w-full rounded-md" />
                  </div>
                  <Skeleton className="h-10 w-28 rounded-xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Skeleton className="h-32 rounded-2xl md:col-span-2" />
                  <Skeleton className="h-32 rounded-2xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Skeleton className="h-64 rounded-2xl" />
                  <Skeleton className="h-64 rounded-2xl" />
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="content-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * ContentLoader para carregar seções internas sem spinners
 */
export const ContentLoader = ({ 
  loading, 
  children, 
  className = "",
  rows = 3
}: { 
  loading: boolean; 
  children: React.ReactNode; 
  className?: string;
  rows?: number;
}) => {
  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="content-skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`space-y-3 py-4 w-full ${className}`}
        >
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </motion.div>
      ) : (
        <motion.div
          key="content-loaded"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageLoader;
