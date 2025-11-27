import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Subject {
  id: string;
  name: string;
  description?: string;
  color: string;
}

interface AddSubjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSubject?: Subject | null;
}

const PRESET_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
];

const AddSubjectDialog = ({ open, onOpenChange, editSubject }: AddSubjectDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  // Preenche os campos ao editar
  useEffect(() => {
    if (open && editSubject) {
      setName(editSubject.name);
      setDescription(editSubject.description || "");
      setColor(editSubject.color);
    } else if (open && !editSubject) {
      resetForm();
    }
  }, [open, editSubject]);

  // Salva ou atualiza a matéria no banco
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Digite o nome da matéria");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const subjectData = {
        name: name.trim(),
        description: description.trim() || null,
        color,
      };

      if (editSubject) {
        // Atualiza matéria existente
        const { error } = await supabase
          .from("subjects")
          .update(subjectData)
          .eq("id", editSubject.id);

        if (error) throw error;
        toast.success("Matéria atualizada com sucesso!");
      } else {
        // Cria nova matéria
        const { error } = await supabase.from("subjects").insert({
          ...subjectData,
          user_id: user.id,
        });

        if (error) throw error;
        toast.success("Matéria criada com sucesso!");
      }

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Erro ao ${editSubject ? "atualizar" : "criar"} matéria: ` + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor(PRESET_COLORS[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editSubject ? "Editar Matéria" : "Nova Matéria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Matéria</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Matemática"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione detalhes sobre a matéria..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    color === presetColor ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => setColor(presetColor)}
                />
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : editSubject ? "Atualizar" : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSubjectDialog;
