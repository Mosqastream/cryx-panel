"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        setStatus("denied");
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        setStatus("denied");
        router.push("/dashboard");
        return;
      }

      setStatus("allowed");
    }

    check();
  }, []);

  if (status === "loading") return <div style={{ color: "white", padding: 20 }}>Cargando...</div>;
  if (status === "denied") return null;

  return <>{children}</>;
}
