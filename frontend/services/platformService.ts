import { supabase } from "@/lib/supabaseClient";

export async function getPlatforms() {
  const { data, error } = await supabase.from("platforms").select("*").order("id", { ascending: true });
  if (error) return [];
  return data;
}
