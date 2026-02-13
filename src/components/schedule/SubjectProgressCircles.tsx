import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";
import { FIXED_SUBJECTS } from "@/lib/subjects";

interface ScheduleItem {
  id: string;
  title: string;
  subject_id?: string | null;
  completed?: boolean;
}

interface SubjectProgressCirclesProps {
  items: ScheduleItem[];
}

const CircularProgress = ({
  percentage,
  color,
  size = 52,
  strokeWidth = 4,
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
};

const SubjectProgressCircles = ({ items }: SubjectProgressCirclesProps) => {
  const subjectStats = useMemo(() => {
    return FIXED_SUBJECTS.map((subject) => {
      const subjectItems = items.filter((i) => i.subject_id === subject.id);
      const total = subjectItems.length;
      const completed = subjectItems.filter((i) => i.completed).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        ...subject,
        total,
        completed,
        percentage,
      };
    }).filter((s) => s.total > 0);
  }, [items]);

  if (subjectStats.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          Progresso por Disciplina
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-3">
          {subjectStats.map((subject) => (
            <div
              key={subject.id}
              className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="relative shrink-0">
                <CircularProgress
                  percentage={subject.percentage}
                  color={subject.color}
                  size={44}
                  strokeWidth={3.5}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                  {subject.percentage}%
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{subject.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {subject.completed}/{subject.total}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SubjectProgressCircles;
