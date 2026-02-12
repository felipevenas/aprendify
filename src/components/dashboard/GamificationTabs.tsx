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
      <CardHeader className="pb-1 pt-3 px-4 shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="study" className="gap-1.5 text-xs h-7">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Plano</span>
            </TabsTrigger>
            <TabsTrigger value="challenges" className="gap-1.5 text-xs h-7">
              <Target className="h-3.5 w-3.5" />
              <span>Desafios</span>
            </TabsTrigger>
            <TabsTrigger value="ranking" className="gap-1.5 text-xs h-7">
              <Trophy className="h-3.5 w-3.5" />
              <span>Ranking</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-1 pb-2 px-3 flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-auto">
          {activeTab === "study" && <DynamicStudyPlan userId={userId} />}
          {activeTab === "challenges" && <WeeklyChallenges userId={userId} />}
          {activeTab === "ranking" && <Leaderboard userId={userId} />}
        </div>
      </CardContent>
    </Card>
  );
};

export default GamificationTabs;
