import { supabase } from "@/lib/supabaseClient";

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function getProfile() {
  const session = await getSession();
  if (!session) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (!data) return null;
  return data;
}
