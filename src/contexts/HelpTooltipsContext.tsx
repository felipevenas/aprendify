import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

interface TooltipInfo {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector or element ID
}

interface HelpTooltipsContextType {
  showTooltips: boolean;
  setShowTooltips: (show: boolean) => void;
  currentTooltipIndex: number;
  setCurrentTooltipIndex: (index: number) => void;
  tooltips: TooltipInfo[];
  setTooltips: (tooltips: TooltipInfo[]) => void;
  startTour: (markAsSeen?: boolean) => void;
  endTour: () => void;
  nextTooltip: () => void;
  prevTooltip: () => void;
  hasSeenTour: boolean;
  hasSeenPageTour: (pageId: string) => boolean;
  markTourAsSeen: () => void;
  markPageTourAsSeen: (pageId: string) => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const HelpTooltipsContext = createContext<HelpTooltipsContextType | undefined>(undefined);

const TOUR_SEEN_KEY = "aprendify_tour_seen";
const PAGE_TOURS_KEY = "aprendify_page_tours_seen";

// Definições de tours para cada página da aplicação
const dashboardTooltips: TooltipInfo[] = [
  {
    id: "countdown-enem",
    title: "Foco no ENEM",
    description: "Acompanhe de perto quantos dias faltam para a prova mais importante do ano.",
    target: "[data-tour='countdown-enem']",
  },
  {
    id: "pomodoro-timer",
    title: "Timer Pomodoro",
    description: "Utilize sessões de foco (25 min) com pausas estruturadas diretamente no seu painel para turbinar sua concentração.",
    target: "[data-tour='pomodoro-timer']",
  },
  {
    id: "performance-areas",
    title: "Desempenho por Áreas",
    description: "Analise seu progresso de acertos e proficiência nas 4 grandes áreas oficiais do ENEM + Redação.",
    target: "[data-tour='performance-areas']",
  },
  {
    id: "study-planning",
    title: "Planejamento Diário",
    description: "Veja o que estudar hoje e organize suas tarefas e metas diárias no painel lateral.",
    target: "[data-tour='study-planning']",
  },
];

const scheduleTooltips: TooltipInfo[] = [
  {
    id: "schedule-actions",
    title: "Ações do Cronograma",
    description: "Alterne entre visualizações semanais e mensais, adicione atividades manuais ou gere um cronograma inteligente com nossa IA.",
    target: "[data-tour='schedule-actions']",
  },
  {
    id: "schedule-stats",
    title: "Métricas de Estudos",
    description: "Monitore suas horas dedicadas, total de sessões criadas e sua aderência às metas estipuladas.",
    target: "[data-tour='schedule-stats']",
  },
  {
    id: "schedule-view",
    title: "Agenda de Estudos",
    description: "Veja os horários planejados para cada disciplina. Clique em uma atividade para conferir dicas rápidas da IA e concluir a tarefa.",
    target: "[data-tour='schedule-view']",
  },
];

const tasksTooltips: TooltipInfo[] = [
  {
    id: "tasks-header",
    title: "Nova Tarefa",
    description: "Crie metas de estudo pontuais e compromissos importantes preenchendo o formulário rápido.",
    target: "[data-tour='tasks-header']",
  },
  {
    id: "tasks-list",
    title: "Lista de Tarefas",
    description: "Gerencie suas atividades. Você pode filtrar, ordenar por prioridade e marcar como concluídas.",
    target: "[data-tour='tasks-list']",
  },
];

const notesTooltips: TooltipInfo[] = [
  {
    id: "notes-header",
    title: "Nova Anotação",
    description: "Crie notas de estudo vinculadas a disciplinas específicas para não perder nenhum resumo.",
    target: "[data-tour='notes-header']",
  },
  {
    id: "notes-list",
    title: "Caderno Digital",
    description: "Visualize, filtre por matéria e edite todas as suas anotações de estudo acumuladas.",
    target: "[data-tour='notes-list']",
  },
];

const statisticsTooltips: TooltipInfo[] = [
  {
    id: "stats-period",
    title: "Filtro de Período",
    description: "Escolha ver o seu desempenho de hoje, da semana, do mês ou o histórico total acumulado.",
    target: "[data-tour='stats-period']",
  },
  {
    id: "stats-summary",
    title: "Resumo Geral",
    description: "Confira rapidamente a quantidade total de questões resolvidas, sua taxa média de acertos e notas de redação.",
    target: "[data-tour='stats-summary']",
  },
  {
    id: "stats-ai",
    title: "Recomendações com IA",
    description: "Solicite à Inteligência Artificial uma análise dos seus pontos fracos e fortes, com sugestões práticas de onde focar os seus estudos.",
    target: "[data-tour='stats-ai']",
  },
];

const questionsTooltips: TooltipInfo[] = [
  {
    id: "questions-actions",
    title: "Controles do Banco",
    description: "Filtre questões por ano e tema, busque uma questão aleatória do ENEM ou faça anotações rápidas.",
    target: "[data-tour='questions-actions']",
  },
  {
    id: "questions-area",
    title: "Área de Prática",
    description: "Resolva a questão ativa selecionando as alternativas. Usuários Premium contam com resoluções explicadas detalhadamente por IA.",
    target: "[data-tour='questions-area']",
  },
];

const simuladosTooltips: TooltipInfo[] = [
  {
    id: "simulados-actions",
    title: "Iniciar Simulado",
    description: "Configure e inicie um novo simulado completo no formato padrão do ENEM para testar seu tempo e resistência.",
    target: "[data-tour='simulados-actions']",
  },
  {
    id: "simulados-stats",
    title: "Histórico de Notas",
    description: "Veja o total de simulados feitos, seu desempenho mensal e a quantidade total de questões resolvidas em simulados.",
    target: "[data-tour='simulados-stats']",
  },
  {
    id: "simulados-history",
    title: "Seus Resultados",
    description: "Consulte seu progresso em exames anteriores, com análises de erros e pontos de melhoria estruturados por IA.",
    target: "[data-tour='simulados-history']",
  },
];

const flashcardsTooltips: TooltipInfo[] = [
  {
    id: "flashcard-tabs",
    title: "Navegação",
    description: "Alterne entre o modo de prática (onde testa sua memória) e a lista completa dos seus cartões cadastrados.",
    target: "[data-tour='flashcard-tabs']",
  },
  {
    id: "flashcard-filters",
    title: "Filtros e Sorteio",
    description: "Filtre seus cartões por matéria específica e sorteie novos flashcards para iniciar seu ciclo de revisão ativa.",
    target: "[data-tour='flashcard-filters']",
  },
  {
    id: "flashcard-area",
    title: "Ciclo de Revisão",
    description: "Tente lembrar a resposta no verso do cartão. Clique para virá-lo e classifique sua facilidade para agendar a próxima revisão.",
    target: "[data-tour='flashcard-area']",
  },
];

const essaysTooltips: TooltipInfo[] = [
  {
    id: "essays-limits",
    title: "Cota Mensal",
    description: "Acompanhe quantas correções de redação você ainda possui disponíveis no seu plano atual.",
    target: "[data-tour='essays-limits']",
  },
  {
    id: "essays-tabs",
    title: "Menu de Redações",
    description: "Alterne entre a área de escrita (onde você redige seu texto) e seu histórico completo de redações corrigidas.",
    target: "[data-tour='essays-tabs']",
  },
  {
    id: "essays-write-area",
    title: "Escrita da Redação",
    description: "Escolha um tema ou digite o seu text. A nossa IA fará uma correção profunda avaliando as 5 competências oficiais do ENEM.",
    target: "[data-tour='essays-write-area']",
  },
];

export const HelpTooltipsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showTooltips, setShowTooltips] = useState(false);
  const [currentTooltipIndex, setCurrentTooltipIndex] = useState(0);
  const [tooltips, setTooltips] = useState<TooltipInfo[]>([]);
  const [hasSeenTour, setHasSeenTour] = useState(true);
  const [seenPageTours, setSeenPageTours] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<string>("dashboard");
  const [userId, setUserId] = useState<string | null>(null);

  const location = useLocation();

  // Redireciona os tooltips reativamente com base na rota ativa
  useEffect(() => {
    const path = location.pathname;
    if (path === "/dashboard") {
      setTooltips(dashboardTooltips);
      setCurrentPage("dashboard");
    } else if (path === "/schedule") {
      setTooltips(scheduleTooltips);
      setCurrentPage("schedule");
    } else if (path === "/tasks") {
      setTooltips(tasksTooltips);
      setCurrentPage("tasks");
    } else if (path === "/notes") {
      setTooltips(notesTooltips);
      setCurrentPage("notes");
    } else if (path === "/statistics") {
      setTooltips(statisticsTooltips);
      setCurrentPage("statistics");
    } else if (path.startsWith("/questions")) {
      setTooltips(questionsTooltips);
      setCurrentPage("questions");
    } else if (path.startsWith("/simulados")) {
      setTooltips(simuladosTooltips);
      setCurrentPage("simulados");
    } else if (path === "/flashcards") {
      setTooltips(flashcardsTooltips);
      setCurrentPage("flashcards");
    } else if (path === "/essays") {
      setTooltips(essaysTooltips);
      setCurrentPage("essays");
    } else {
      setTooltips([]);
      setCurrentPage("other");
    }
  }, [location.pathname]);

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if user has seen the dashboard tour (user-specific)
  useEffect(() => {
    if (!userId) return;

    const userTourKey = `${TOUR_SEEN_KEY}_${userId}`;
    const seen = localStorage.getItem(userTourKey);
    setHasSeenTour(seen === "true");

    // Load page tours
    const userPageToursKey = `${PAGE_TOURS_KEY}_${userId}`;
    const pageTours = localStorage.getItem(userPageToursKey);
    if (pageTours) {
      try {
        const parsed = JSON.parse(pageTours);
        setSeenPageTours(new Set(parsed));
      } catch {
        setSeenPageTours(new Set());
      }
    }
  }, [userId]);

  const startTour = useCallback((markAsSeen: boolean = false) => {
    setCurrentTooltipIndex(0);
    setShowTooltips(true);
    // Mark as seen immediately when auto-started for new users
    if (markAsSeen && userId) {
      const userTourKey = `${TOUR_SEEN_KEY}_${userId}`;
      localStorage.setItem(userTourKey, "true");
      setHasSeenTour(true);
    }
  }, [userId]);

  const endTour = useCallback(() => {
    setShowTooltips(false);
    setCurrentTooltipIndex(0);
  }, []);

  const nextTooltip = useCallback(() => {
    if (currentTooltipIndex < tooltips.length - 1) {
      setCurrentTooltipIndex((prev) => prev + 1);
    } else {
      endTour();
    }
  }, [currentTooltipIndex, tooltips.length, endTour]);

  const prevTooltip = useCallback(() => {
    if (currentTooltipIndex > 0) {
      setCurrentTooltipIndex((prev) => prev - 1);
    }
  }, [currentTooltipIndex]);

  const markTourAsSeen = useCallback(() => {
    if (!userId) return;
    const userTourKey = `${TOUR_SEEN_KEY}_${userId}`;
    localStorage.setItem(userTourKey, "true");
    setHasSeenTour(true);
  }, [userId]);

  const hasSeenPageTour = useCallback((pageId: string) => {
    return seenPageTours.has(pageId);
  }, [seenPageTours]);

  const markPageTourAsSeen = useCallback((pageId: string) => {
    if (!userId) return;
    const newSeen = new Set(seenPageTours);
    newSeen.add(pageId);
    setSeenPageTours(newSeen);
    
    const userPageToursKey = `${PAGE_TOURS_KEY}_${userId}`;
    localStorage.setItem(userPageToursKey, JSON.stringify(Array.from(newSeen)));
  }, [userId, seenPageTours]);

  return (
    <HelpTooltipsContext.Provider
      value={{
        showTooltips,
        setShowTooltips,
        currentTooltipIndex,
        setCurrentTooltipIndex,
        tooltips,
        setTooltips,
        startTour,
        endTour,
        nextTooltip,
        prevTooltip,
        hasSeenTour,
        hasSeenPageTour,
        markTourAsSeen,
        markPageTourAsSeen,
        currentPage,
        setCurrentPage,
      }}
    >
      {children}
    </HelpTooltipsContext.Provider>
  );
};

export const useHelpTooltips = () => {
  const context = useContext(HelpTooltipsContext);
  if (context === undefined) {
    throw new Error("useHelpTooltips must be used within a HelpTooltipsProvider");
  }
  return context;
};
