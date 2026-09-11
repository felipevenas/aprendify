import React from "react";
import { Skeleton } from "./skeleton";

/**
 * Skeleton da casca completa da aplicação (Sidebar + Topbar + Conteúdo)
 * Usado nos SuspenseFallback de rotas (App.tsx e AppLayout.tsx)
 * Garante que a transição entre telas não tenha flash ou spinners giratórios.
 */
export const AppSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-background app-layout-container flex">
      {/* Sidebar Desktop Simulada */}
      <aside className="hidden lg:flex flex-col w-64 fixed left-0 top-0 bottom-0 bg-card border-r border-border/50 z-40 p-4 space-y-6">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-2 py-1">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-6 w-28" />
        </div>

        {/* Menu Groups */}
        <div className="space-y-6 flex-1 pt-2">
          {/* Grupo 1: Estudos */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 mx-2" />
            <div className="space-y-1.5">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>

          {/* Grupo 2: Prática */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 mx-2" />
            <div className="space-y-1.5">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </aside>

      {/* Área Principal de Conteúdo */}
      <main className="flex-1 max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* Topbar Simulada */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/40">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>

        {/* Blocos de Conteúdo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-2xl md:col-span-2" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </main>
    </div>
  );
};

/**
 * Skeleton para o Dashboard do Estudante
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Banner de Boas-vindas */}
      <div className="p-6 rounded-2xl border border-border/60 bg-card/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Regressiva e Métricas */}
        <div className="xl:col-span-2 space-y-6">
          {/* Card Regressiva ENEM */}
          <Skeleton className="h-48 rounded-2xl" />

          {/* Grid de 4 Áreas do ENEM */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>

          {/* Card de Gráfico ou Atividades Recentes */}
          <Skeleton className="h-64 rounded-2xl" />
        </div>

        {/* Coluna Direita: Metas e Pomodoro */}
        <div className="space-y-6">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton para Grid de Cards (Simulados, Redações, Flashcards)
 */
export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Barra de Ações e Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Skeleton className="h-10 w-full sm:w-72 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="p-5 rounded-2xl border border-border/60 bg-card/60 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton para Listas e Tabelas (Caderno de Erros, Banco de Questões, Tarefas)
 */
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="space-y-4 animate-fade-in w-full">
      {/* Header da Lista */}
      <div className="flex items-center justify-between gap-4 mb-2">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Linhas da Lista */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="p-4 rounded-xl border border-border/50 bg-card/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 flex-1">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-3/4 max-w-md" />
                <Skeleton className="h-3 w-1/2 max-w-xs" />
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton apenas da área de conteúdo de página (sem Sidebar nem Topbar).
 * Usado pelo Suspense dentro do AppLayout para garantir que a Sidebar nunca suma.
 */
export const PageContentSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-background app-layout-container">
      <main className="relative max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8 w-full animate-fade-in">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/40">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56 rounded-xl" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-2xl md:col-span-2" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </main>
    </div>
  );
};
