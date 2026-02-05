"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./dashboard.module.css";

type Platform = { id: number; name: string };
type Assignment = {
  id: number;
  mail_alias?: { alias?: string; domain?: string; full_email?: string };
  platform?: { id?: number; name?: string };
};

type EmailItem = {
  from: string;
  to: string;
  subject: string;
  date: string;
  html?: string | null;
  text?: string | null;
};

const API_BASE =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_IMAP_API
    ? process.env.NEXT_PUBLIC_IMAP_API
    : "http://localhost:4001";

export default function Dashboard() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  const [search, setSearch] = useState("");
  const [modalEmails, setModalEmails] = useState<EmailItem[] | null>(null);
  const [modalAlias, setModalAlias] = useState("");
  const [msg, setMsg] = useState("");
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [platformRefreshLoading, setPlatformRefreshLoading] = useState<Record<number, boolean>>({});
  const [globalRefreshLoading, setGlobalRefreshLoading] = useState(false);
  const [modalRefreshLoading, setModalRefreshLoading] = useState(false);
  const [consultLoading, setConsultLoading] = useState<Record<string, boolean>>({});
  const [expandedEmailIndex, setExpandedEmailIndex] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (!selectedPlatform) {
      setFilteredAssignments([]);
      return;
    }
    const filtered = assignments
      .filter((a) => a.platform?.id === selectedPlatform.id)
      .filter((a) => {
        const email = (
          a.mail_alias?.full_email ||
          `${a.mail_alias?.alias}@${a.mail_alias?.domain}` ||
          ""
        ).toLowerCase();
        return email.includes(search.toLowerCase());
      });
    setFilteredAssignments(filtered);
  }, [search, selectedPlatform, assignments]);

  async function fetchAssignments() {
    setMsg("");
    setLoadingAssignments(true);
    try {
      const userResp = await supabase.auth.getUser();
      const user = userResp.data.user;
      if (!user) {
        setMsg("⚠ No hay usuario autenticado.");
        setAssignments([]);
        setPlatforms([]);
        setLoadingAssignments(false);
        return;
      }

      const { data, error } = await supabase
        .from("assignments")
        .select(`
          id,
          mail_alias:mail_alias_id(full_email, alias, domain),
          platform:platform_id(id, name)
        `)
        .eq("profile_id", user.id);

      if (error) {
        console.error("fetchAssignments error:", error);
        setMsg("❌ Error cargando asignaciones");
        setAssignments([]);
        setPlatforms([]);
        setLoadingAssignments(false);
        return;
      }

      const asg = (data as Assignment[]) || [];
      setAssignments(asg);

      const map = new Map<number, Platform>();
      asg.forEach((a) => {
        const pid = a.platform?.id;
        if (pid && a.platform?.name) map.set(pid, { id: pid, name: a.platform!.name! });
      });
      const uniquePlatforms = Array.from(map.values()).sort((x, y) =>
        x.name.localeCompare(y.name)
      );
      setPlatforms(uniquePlatforms);

      if (selectedPlatform) {
        const refreshed = uniquePlatforms.find((p) => p.id === selectedPlatform.id) || null;
        setSelectedPlatform(refreshed);
      }

      setMsg("");
    } catch (err) {
      console.error(err);
      setMsg("❌ Error inesperado cargando asignaciones");
    } finally {
      setLoadingAssignments(false);
    }
  }

  function handleSelectPlatform(p: Platform) {
    setSelectedPlatform(p);
    setSearch("");
    setModalEmails(null);
    setMsg("");
  }

  async function handlePlatformRefresh(e: React.MouseEvent, p: Platform) {
    e.stopPropagation();
    setPlatformRefreshLoading((prev) => ({ ...prev, [p.id]: true }));
    try {
      await fetchAssignments();
      setMsg(`✔ Refrescado ${p.name}`);
    } catch {
      setMsg("❌ Error refrescando plataforma");
    } finally {
      setPlatformRefreshLoading((prev) => ({ ...prev, [p.id]: false }));
    }
  }

  async function handleGlobalRefresh() {
    setGlobalRefreshLoading(true);
    await fetchAssignments();
    setGlobalRefreshLoading(false);
  }

  function getFullEmail(a: Assignment) {
    return (
      a.mail_alias?.full_email ||
      `${a.mail_alias?.alias}@${a.mail_alias?.domain}`
    ).trim();
  }

  function aliasForSend(fullEmail: string) {
    const domain = "@cryxteam.com";
    if (fullEmail.toLowerCase().endsWith(domain)) {
      return fullEmail.slice(0, fullEmail.length - domain.length);
    }
    return fullEmail;
  }

  async function handleConsult(aliasRow: Assignment) {
    const full = getFullEmail(aliasRow);
    if (!full) {
      setMsg("⚠ Alias inválido.");
      return;
    }

    const sendAlias = aliasForSend(full);
    setModalAlias(full);
    setModalEmails(null);
    setMsg("⏳ Consultando…");
    setExpandedEmailIndex({});
    setConsultLoading((prev) => ({ ...prev, [sendAlias]: true }));

    try {
      const platformName = (aliasRow.platform?.name || "all").toLowerCase();
const res = await fetch(`${API_BASE}/emails?alias=${encodeURIComponent(sendAlias)}&platform=${encodeURIComponent(platformName)}`);
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();

      const emails: EmailItem[] = (data.emails || []).map((e: any) => ({
        from: e.from || "(sin remitente)",
        to: e.to || "",
        subject: e.subject || "(sin asunto)",
        date: e.date || new Date().toISOString(),
        html: e.html ?? null,
        text: e.text ?? null,
      }));

      setModalEmails(emails);
      setMsg("");
    } catch (err) {
      console.error("handleConsult error:", err);
      setMsg("❌ Error consultando correos");
      setModalEmails([]);
    } finally {
      setConsultLoading((prev) => ({ ...prev, [sendAlias]: false }));
    }
  }

  async function handleModalRefresh() {
    if (!modalAlias) return;

    const sendAlias = aliasForSend(modalAlias);
    setModalRefreshLoading(true);
    setMsg("⏳ Refrescando correos...");
    try {
      const platformName = (selectedPlatform?.name || "all").toLowerCase();
const res = await fetch(`${API_BASE}/emails?alias=${encodeURIComponent(sendAlias)}&platform=${encodeURIComponent(platformName)}`);
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();

      const emails: EmailItem[] = (data.emails || []).map((e: any) => ({
        from: e.from || "(sin remitente)",
        to: e.to || "",
        subject: e.subject || "(sin asunto)",
        date: e.date || new Date().toISOString(),
        html: e.html ?? null,
        text: e.text ?? null,
      }));

      setModalEmails(emails);
      setMsg("");
    } catch (err) {
      console.error("modal refresh error:", err);
      setMsg("❌ Error refrescando correos");
    } finally {
      setModalRefreshLoading(false);
    }
  }

  function toggleExpandEmail(i: number) {
    setExpandedEmailIndex((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function closeModal() {
    setModalEmails(null);
    setModalAlias("");
    setMsg("");
    setExpandedEmailIndex({});
  }

  return (
    <div className={styles.wrapper}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <h1 className={styles.title}>Tus plataformas</h1>
        <button className={styles.smallRefresh} onClick={handleGlobalRefresh}>
          {globalRefreshLoading ? "…" : "Refrescar todo"}
        </button>
      </div>

      {!selectedPlatform && (
        <div className={styles.platformList}>
          {platforms.length === 0 && <p>{loadingAssignments ? "Cargando..." : "No hay plataformas."}</p>}

          {platforms.map((p) => {
            const count = assignments.filter((a) => a.platform?.id === p.id).length;
            const loading = !!platformRefreshLoading[p.id];
            return (
              <div
                key={p.id}
                className={styles.platformCard}
                onClick={() => handleSelectPlatform(p)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <span className={styles.pName}>🎬 {p.name}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={styles.badge}>{count} correos</span>
                    <button
                      className={styles.iconBtn}
                      onClick={(e) => handlePlatformRefresh(e, p)}
                      disabled={loading}
                    >
                      {loading ? "…" : "⟳"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPlatform && (
        <div className={styles.container}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <button className={styles.backBtn} onClick={() => setSelectedPlatform(null)}>
              ← Volver
            </button>
            <h2 className={styles.subtitle} style={{ margin: 0 }}>
              {selectedPlatform.name}
            </h2>
            <button
              className={styles.smallRefresh}
              onClick={() => fetchAssignments()}
              disabled={loadingAssignments}
            >
              {loadingAssignments ? "…" : "Refrescar asignaciones"}
            </button>
          </div>

          <input
            className={styles.input}
            placeholder="Buscar correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className={styles.mailList}>
            {filteredAssignments.length === 0 && <p>No hay correos o no coinciden.</p>}

            {filteredAssignments.map((a) => {
              const full = getFullEmail(a);
              const sendAlias = aliasForSend(full);
              const isConsulting = !!consultLoading[sendAlias];
              return (
                <div key={a.id} className={styles.mailRow}>
                  <span className={styles.mailText} title={full}>
                    {full}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className={styles.consultBtn}
                      onClick={() => handleConsult(a)}
                      disabled={isConsulting}
                    >
                      {isConsulting && modalAlias === full ? "⏳" : "Consultar"}
                    </button>
                    <button
                      className={styles.smallRefresh}
                      onClick={() => {
                        fetchAssignments();
                        setMsg(`✔ Refrescado asignaciones (alias: ${full})`);
                      }}
                    >
                      ⟳
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalEmails && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className={styles.modalTitle}>📬 {modalAlias}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={styles.smallRefresh}
                  onClick={handleModalRefresh}
                  disabled={modalRefreshLoading}
                >
                  {modalRefreshLoading ? "…" : "Refrescar emails"}
                </button>
                <button className={styles.closeBtn} onClick={closeModal}>
                  Cerrar
                </button>
              </div>
            </div>

            {modalEmails.length === 0 ? (
              <p>No hay correos.</p>
            ) : (
              <ul className={styles.emailList}>
                {modalEmails.map((e, i) => (
                  <li key={i} className={styles.emailItem}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ flex: 1 }}>
                        <b>{e.subject}</b>
                        <div className={styles.emailMeta}>
                          <small>De: {e.from}</small> •{" "}
                          <small>{new Date(e.date).toLocaleString()}</small>
                        </div>
                      </div>

                      <button
                        className={styles.smallRefresh}
                        onClick={() => toggleExpandEmail(i)}
                      >
                        {expandedEmailIndex[i] ? "Ocultar" : "Ver"}
                      </button>
                    </div>

                    {expandedEmailIndex[i] && (
  <div style={{ marginTop: 10 }}>
    {e.html ? (
      <iframe
        style={{
          width: "100%",
          height: 350,
          border: "none",
          background: "#fff"
        }}
        sandbox="allow-same-origin allow-popups allow-forms"
        srcDoc={e.html}
      />
    ) : e.text ? (
      <pre style={{ whiteSpace: "pre-wrap", maxHeight: 350, overflow: "auto" }}>
        {e.text}
      </pre>
    ) : (
      <p>(sin contenido)</p>
    )}
  </div>
)}

                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {msg && <p className={styles.msg}>{msg}</p>}
    </div>
  );
}
