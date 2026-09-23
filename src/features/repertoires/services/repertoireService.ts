import { supabase } from "@/integrations/supabase/client";
import type { GeneratedRepertoire, RepertoireDraft, SocioculturalRepertoire } from "../types";

const TABLE = "repertorios_socioculturais";
export const repertoireService = {
  async list(userId: string, signal?: AbortSignal): Promise<SocioculturalRepertoire[]> {
    let query = supabase.from(TABLE).select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as SocioculturalRepertoire[];
  },

  async create(userId: string, draft: RepertoireDraft): Promise<SocioculturalRepertoire> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ ...toPersistence(draft), user_id: userId })
      .select("*")
      .single();
    if (error) throw error;
    return data as SocioculturalRepertoire;
  },

  async update(id: string, userId: string, draft: RepertoireDraft): Promise<SocioculturalRepertoire> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(toPersistence(draft))
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data as SocioculturalRepertoire;
  },

  async remove(id: string, userId: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  },

  async generate(topic: string, context?: string): Promise<GeneratedRepertoire> {
    const { data, error } = await supabase.functions.invoke<{ repertoire: GeneratedRepertoire }>(
      "generate-sociocultural-repertoire",
      { body: { topic, context: context?.trim() || undefined } },
    );
    if (error) throw error;
    if (!data?.repertoire) throw new Error("A geração não retornou um repertório válido.");
    return data.repertoire;
  },
};

function toPersistence(draft: RepertoireDraft) {
  return {
    ...draft,
    source_title: draft.source_title?.trim() || null,
    source_author: draft.source_author?.trim() || null,
    source_year: draft.source_year?.trim() || null,
    source_url: draft.source_url?.trim() || null,
  };
}
