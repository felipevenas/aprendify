import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Título principal da página */
  title: React.ReactNode;
  /** Descrição ou subtítulo conciso */
  description?: React.ReactNode;
  /** Ícone opcional do Lucide */
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  /** Badge contextual opcional ao lado do título */
  badge?: React.ReactNode;
  /** Botões ou controles de ação posicionados à direita */
  actions?: React.ReactNode;
  /** Classes CSS adicionais para o container */
  className?: string;
  /** Elementos extras abaixo do cabeçalho (ex: tabs, filtros secundários) */
  children?: React.ReactNode;
}

/**
 * Componente padrão e minimalista de cabeçalho de página.
 * Focado em clareza, hierarquia equilibrada e aproveitamento vertical da tela.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  badge,
  actions,
  className,
  children,
}) => {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-muted/60 text-foreground/80 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
};

export default PageHeader;
