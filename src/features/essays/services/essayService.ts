import { supabase } from "@/integrations/supabase/client";
import { Essay } from "../types";

export const essayService = {
  async getEssayOptions(
    userId: string,
    signal?: AbortSignal,
  ): Promise<Pick<Essay, "id" | "title" | "created_at">[]> {
    let query = supabase
      .from("essays")
      .select("id,title,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (signal) query = query.abortSignal(signal);

    const { data, error } = await query;
    if (error) throw error;

    // Keep the legacy generated database type behind this service boundary.
    return (data || []) as Pick<Essay, "id" | "title" | "created_at">[];
  },

  async getEssays(userId: string): Promise<Essay[]> {
    const { data, error } = await supabase
      .from("essays")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    // The generated Supabase table type still reflects the legacy essay columns;
    // the adapter keeps that external mismatch at the infrastructure boundary.
    return (data || []) as unknown as Essay[];
  },

  async getMonthlyEssayCount(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc("get_monthly_essay_count", {
      _user_id: userId,
    });

    if (error) throw error;
    return data ?? 0;
  },
};
