import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4 shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Estudo & Gamificação
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-3 px-4 flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-3 mb-3 shrink-0">
            <TabsTrigger value="study" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Plano</span>
            </TabsTrigger>
            <TabsTrigger value="challenges" className="gap-1.5 text-xs">
              <Target className="h-3.5 w-3.5" />
              <span>Desafios</span>
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-1.5 text-xs">
              <Trophy className="h-3.5 w-3.5" />
              <span>Ranking</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-auto">
            <TabsContent value="study" className="mt-0 h-full">
              <DynamicStudyPlan userId={userId} />
            </TabsContent>

            <TabsContent value="challenges" className="mt-0 h-full">
              <WeeklyChallenges userId={userId} />
            </TabsContent>

            <TabsContent value="ranking" className="mt-0 h-full">
              <Leaderboard userId={userId} />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GamificationTabs;
