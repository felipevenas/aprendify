import React from "react";
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


        {loading ? (
          <div
            key="skeleton-view"
            className="w-full"
            role="status"
            aria-label="Carregando conteúdo"
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
          </div>
        ) : (
          <div
            key="content-view"
            className="w-full content-enter"
          >
            {children}
          </div>
        )}
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
    <div aria-busy={loading}>
      {loading ? (
        <div
          key="content-skeleton"
          role="status"
          aria-label="Carregando conteúdo"
          className={`space-y-3 py-4 w-full ${className}`}
        >
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div
          key="content-loaded"
          className="w-full content-enter"
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default PageLoader;
