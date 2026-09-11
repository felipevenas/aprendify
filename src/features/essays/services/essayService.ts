import { supabase } from "@/integrations/supabase/client";
import { Essay } from "../types";

export const essayService = {
  async getEssays(userId: string): Promise<Essay[]> {
    const { data, error } = await supabase
      .from("essays")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Essay[];
  },

  async getMonthlyEssayCount(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc("get_monthly_essay_count", {
      _user_id: userId,
    });

    if (error) throw error;
    return data ?? 0;
  },
};
