import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Trophy, Target } from "lucide-react";
import DynamicStudyPlan from "./DynamicStudyPlan";
import WeeklyChallenges from "./WeeklyChallenges";
import Leaderboard from "./Leaderboard";

interface GamificationTabsProps {
  userId?: string;
}

/**
 * Componente unificado que agrupa funcionalidades de gamificação em tabs
 * para manter o dashboard minimalista
 */
const GamificationTabs = ({ userId }: GamificationTabsProps) => {
  const [activeTab, setActiveTab] = useState("study");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full grid grid-cols-3 mb-4">
        <TabsTrigger value="study" className="gap-1.5 text-xs sm:text-sm">
          <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Plano de Estudo</span>
          <span className="sm:hidden">Plano</span>
        </TabsTrigger>
        <TabsTrigger value="challenges" className="gap-1.5 text-xs sm:text-sm">
          <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Desafios</span>
          <span className="sm:hidden">Desafios</span>
        </TabsTrigger>
        <TabsTrigger value="ranking" className="gap-1.5 text-xs sm:text-sm">
          <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Ranking</span>
          <span className="sm:hidden">Ranking</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="study" className="mt-0">
        <DynamicStudyPlan userId={userId} />
      </TabsContent>

      <TabsContent value="challenges" className="mt-0">
        <WeeklyChallenges userId={userId} />
      </TabsContent>

      <TabsContent value="ranking" className="mt-0">
        <Leaderboard userId={userId} />
      </TabsContent>
    </Tabs>
  );
};

export default GamificationTabs;
