import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Flame } from "lucide-react";
import QuestionStatsChart from "./QuestionStatsChart";
import StudyHeatmap from "./StudyHeatmap";

interface ProgressTabsProps {
  userId?: string;
}

const ProgressTabs = ({ userId }: ProgressTabsProps) => {
  const [activeTab, setActiveTab] = useState("chart");

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-1 pt-3 px-4 shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-8">
            <TabsTrigger value="chart" className="gap-1.5 text-xs h-7">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Progresso</span>
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="gap-1.5 text-xs h-7">
              <Flame className="h-3.5 w-3.5" />
              <span>Frequência</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-0 pb-2 px-0 flex-1 min-h-0">
        {activeTab === "chart" ? (
          <div className="h-full px-0">
            <QuestionStatsChart embedded />
          </div>
        ) : (
          <div className="px-2">
            <StudyHeatmap userId={userId} embedded />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProgressTabs;
