import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Subject {
  id: string;
  name: string;
  color: string;
  description?: string;
}

const SubjectsList = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setSubjects(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar matérias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();

    const channel = supabase
      .channel("subjects_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subjects",
        },
        () => {
          fetchSubjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Matéria removida!");
    } catch (error: any) {
      toast.error("Erro ao remover matéria");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (subjects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">Nenhuma matéria cadastrada</p>
        <p className="text-muted-foreground text-sm mt-2">
          Clique em "Nova matéria" para começar
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {subjects.map((subject) => (
        <div
          key={subject.id}
          className="p-4 rounded-lg border-2 hover:shadow-lg transition-all group"
          style={{ borderColor: subject.color }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div
                className="w-10 h-10 rounded-full mb-3"
                style={{ backgroundColor: subject.color }}
              />
              <h3 className="font-semibold text-lg mb-1">{subject.name}</h3>
              {subject.description && (
                <p className="text-sm text-muted-foreground">{subject.description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDelete(subject.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SubjectsList;
