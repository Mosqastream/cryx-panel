"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./d1nspcl1.module.css";
import { useRouter } from "next/navigation";

type Platform = { id: number; name: string; active?: boolean };

type Assignment = {
  id: number;
  mail_alias?: { full_email?: string; alias?: string; domain?: string };
  platform?: { id?: number; name?: string };
  days_total?: number | null;
  days_start_at?: string | null;
};

const DOMAIN = "cryxteam.com";

export default function SecretPanel() {
  const [username, setUsername] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [alias, setAlias] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  const [days, setDays] = useState<string>(""); // ✅ NUEVO
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const router = useRouter();

  useEffect(() => {
    fetchPlatforms();
  }, []);

  // --- Plataformas ---
  async function fetchPlatforms(): Promise<void> {
    const { data, error } = await supabase
      .from("platforms")
      .select("id, name, active")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetchPlatforms:", error);
      setMsg("❌ Error cargando plataformas.");
      return;
    }
    setPlatforms((data as Platform[]) || []);
  }

  async function createPlatform(name: string): Promise<void> {
    if (!name.trim()) {
      setMsg("⚠ Nombre de plataforma vacío.");
      return;
    }
    setMsg("");
    const { data, error } = await supabase
      .from("platforms")
      .insert({ name: name.trim(), active: true })
      .select()
      .single();

    if (error) {
      setMsg("❌ Error creando plataforma: " + error.message);
      return;
    }
    setMsg("✔ Plataforma creada: " + (data as any).name);
    fetchPlatforms();
  }

  async function deletePlatform(id: number): Promise<void> {
    if (!confirm("¿Eliminar plataforma?")) return;

    const { error } = await supabase.from("platforms").delete().eq("id", id);

    if (error) {
      setMsg("❌ Error eliminando plataforma: " + error.message);
      return;
    }

    setMsg("✔ Plataforma eliminada.");
    fetchPlatforms();
  }

  // --- Logout ---
  async function handleLogout(): Promise<void> {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // --- Usuario y asignaciones ---
  async function fetchUser(): Promise<void> {
    setMsg("");
    setUserId(null);
    setAssignments([]);

    if (!username.trim()) {
      setMsg("⚠ Escribe el username y luego presiona Buscar.");
      return;
    }

    setLoading(true);
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", username.trim())
      .single();

    setLoading(false);

    if (error || !profile) {
      setMsg("⚠ Usuario no encontrado.");
      return;
    }

    setUserId(profile.id);
    setMsg("✔ Usuario encontrado: " + profile.username);
    fetchAssignments(profile.id);
  }

  async function fetchAssignments(uid: string): Promise<void> {
    const { data, error } = await supabase
      .from("assignments")
      .select(`
        id,
        days_total,
        days_start_at,
        mail_alias:mail_alias_id(full_email, alias, domain),
        platform:platform_id(id, name)
      `)
      .eq("profile_id", uid)
      .order("id", { ascending: true });

    if (error) {
      console.error("fetchAssignments error:", error);
      setMsg("❌ Error cargando asignaciones.");
      return;
    }

    setAssignments((data as Assignment[]) || []);
  }

  // --- Asignar alias ---
  async function assignAlias(): Promise<void> {
    setMsg("");

    if (!userId) {
      setMsg("⚠ Primero busca y confirma el usuario.");
      return;
    }
    if (!alias.trim()) {
      setMsg("⚠ Escribe un alias.");
      return;
    }
    if (!platform) {
      setMsg("⚠ Selecciona una plataforma.");
      return;
    }

    setLoading(true);

    // Hacemos upsert por `alias` con alias+domain (no forzamos full_email)
    const upsertPayload = { alias: alias.trim(), domain: DOMAIN };

    const { data: aliasRow, error: aliasError } = await supabase
      .from("mail_alias")
      .upsert(upsertPayload, { onConflict: "alias" })
      .select("id, alias, domain, full_email")
      .single();

    if (aliasError || !aliasRow?.id) {
      // fallback: intentar obtener alias existente
      const { data: fallback, error: fErr } = await supabase
        .from("mail_alias")
        .select("id, alias, domain, full_email")
        .eq("alias", alias.trim())
        .maybeSingle();

      setLoading(false);

      if (fErr || !fallback) {
        setMsg("❌ Error alias: no se pudo crear ni recuperar.");
        return;
      }

      // si fallback existe, usamos su id para crear la asignación
      await tryCreateAssignment((fallback as any).id);
      return;
    }

    // ahora crear assignment
    await tryCreateAssignment((aliasRow as any).id);
  }

  async function tryCreateAssignment(mailAliasId: number): Promise<void> {
    // Chequeo duplicado
    const { data: exists } = await supabase
      .from("assignments")
      .select("id")
      .eq("profile_id", userId)
      .eq("mail_alias_id", mailAliasId)
      .eq("platform_id", Number(platform))
      .maybeSingle();

    if ((exists as any)?.id) {
      setLoading(false);
      setMsg("⚠ Asignación ya existe.");
      return;
    }

    // ✅ NUEVO: days_total + days_start_at (empieza a correr AHORA)
    const daysNum = days.trim() ? Number(days.trim()) : null;

    const { error } = await supabase.from("assignments").insert({
      profile_id: userId,
      mail_alias_id: mailAliasId,
      platform_id: Number(platform),
      days_total: daysNum,
      days_start_at: daysNum ? new Date().toISOString() : null,
    });

    setLoading(false);

    if (error) {
      setMsg("❌ Error asignando: " + error.message);
      return;
    }

    setMsg("✔ Correo asignado correctamente.");
    setAlias("");
    setPlatform("");
    setDays(""); // ✅ NUEVO
    if (userId) await fetchAssignments(userId);
  }

  // --- ELIMINAR ASIGNACIÓN (nuevo) ---
  async function deleteAssignment(id: number): Promise<void> {
    if (!confirm("¿Eliminar esta asignación? Esta acción es irreversible.")) return;

    setLoading(true);
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    setLoading(false);

    if (error) {
      setMsg("❌ Error eliminando asignación: " + error.message);
      return;
    }

    setMsg("✔ Asignación eliminada.");
    // refrescar lista (si tenemos userId)
    if (userId) await fetchAssignments(userId);
  }

  return (
    <div className={styles.wrapper}>
      {/* TOP BAR */}
      <div className={styles.topBar}>
        <span className={styles.topText}>ADMIN SECRETO</span>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>

      <h1 className={styles.title}>Panel secreto</h1>

      {/* --- ROW: left = Buscar/Asignar, right = Plataformas */}
      <div className={styles.columns}>
        <div className={styles.left}>
          <div className={styles.card}>
            <div className={styles.row}>
              <span className={styles.step}>1</span>
              <b>Buscar usuario</b>
            </div>

            <input
              className={styles.input}
              placeholder="username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button className={styles.btn} onClick={fetchUser} disabled={loading}>
                {loading ? "…" : "Buscar"}
              </button>
              <button
                className={styles.secondary}
                onClick={() => {
                  setUsername("");
                  setUserId(null);
                  setAssignments([]);
                  setMsg("");
                }}
              >
                Limpiar
              </button>
            </div>

            {userId && <div className={styles.found}>✔ Usuario encontrado</div>}
          </div>

          {userId && (
            <div className={styles.card}>
              <div className={styles.row}>
                <span className={styles.step}>2</span>
                <b>Asignar correo</b>
              </div>

              <input
                className={styles.input}
                placeholder="alias (ej: pepito)"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />

              <select
                className={styles.input}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="">Selecciona plataforma...</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* ✅ NUEVO: DIAS */}
              <input
                className={styles.input}
                placeholder="Días (ej: 30) — opcional"
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
              />

              <button className={styles.btn} onClick={assignAlias} disabled={loading}>
                {loading ? "..." : "Asignar"}
              </button>

              <h3>Asignados</h3>

              {assignments.length === 0 ? (
                <p>No hay correos asignados.</p>
              ) : (
                <ul className={styles.list}>
                  {assignments.map((a) => (
                    <li
                      key={a.id}
                      className={styles.asgRow}
                    >
                      <span>
                        {a.mail_alias?.full_email || `${a.mail_alias?.alias}@${a.mail_alias?.domain}`}{" "}
                        → <b>{a.platform?.name ?? "—"}</b>

                        {/* ✅ NUEVO: badge dias */}
                        {typeof a.days_total === "number" && a.days_start_at ? (
                          <span className={styles.daysBadge}>
                            ⏳ {a.days_total} días
                          </span>
                        ) : (
                          <span className={styles.daysBadgeMuted}>
                            ⏳ sin días
                          </span>
                        )}
                      </span>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className={styles.smallDelete}
                          onClick={() => deleteAssignment(a.id)}
                          title="Eliminar asignación"
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className={styles.right}>
          {/* Plataformas */}
          <div className={styles.card}>
            <div className={styles.row}>
              <span className={styles.step}>P</span>
              <b>Administrar plataformas</b>
            </div>

            <PlatformManager
              platforms={platforms}
              onCreate={createPlatform}
              onDelete={deletePlatform}
            />
          </div>
        </div>
      </div>

      {msg && <p className={styles.msg}>{msg}</p>}
    </div>
  );
}

function PlatformManager(props: {
  platforms: Platform[];
  onCreate: (name: string) => void;
  onDelete: (id: number) => void;
}) {
  const { platforms, onCreate, onDelete } = props;
  const [name, setName] = useState<string>("");

  return (
    <div>
      <input
        className={styles.input}
        placeholder="Nueva plataforma (ej: Netflix)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          className={styles.btn}
          onClick={() => {
            onCreate(name);
            setName("");
          }}
        >
          Crear
        </button>
        <button
          className={styles.secondary}
          onClick={() => setName("")}
        >
          Limpiar
        </button>
      </div>

      <ul className={styles.list}>
        {platforms.map((p) => (
          <li key={p.id} style={{ display: "flex", justifyContent: "space-between" }}>
            {p.name}
            <button
              className={styles.smallDelete}
              onClick={() => onDelete(p.id)}
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
