import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/**
 * 🔥 FUNCIÓN PRINCIPAL
 * - Devuelve SOLO 3 correos
 * - BLOQUEA SOLO correos de "cambiar correo/email" (ES/EN/PT)
 * - Filtra por plataforma (cualquiera que agregues en tu panel)
 * - ✅ MODO ESTRICTO: el correo DEBE contener la plataforma en subject o from
 */
export async function fetchEmailsForAlias(alias, platform = "all") {
  const client = new ImapFlow({
    host: "mail.cryxteam.com",
    port: 993,
    secure: true,
    auth: {
      user: "admin@cryxteam.com", // 👈 tu correo
      pass: "a^cov2vsK_gcqX.0" // 👈 tu contraseña
    }
  });

  const emails = [];

  // ✅ SOLO bloqueo de cambio de correo/email (ES/EN/PT)
  const BLOCK_EMAIL_CHANGE = [
    // Español
    "cambiar correo",
    "cambio de correo",
    "actualizar correo",
    "actualización de correo",
    "verifica tu correo",
    "verificar correo",
    "confirmar correo",
    "confirmación de correo",

    // Inglés
    "change email",
    "email change",
    "update email",
    "email update",
    "verify your email",
    "verify email",
    "confirm email",
    "email confirmation",

    // Portugués (con y sin acento)
    "alterar email",
    "trocar email",
    "mudança de email",
    "mudanca de email",
    "atualizar email",
    "atualizacao de email",
    "atualização de email",
    "verificar email",
    "confirmar email",
    "confirmacao de email",
    "confirmação de email"
  ];

  function shouldBlockEmailChange(subjectRaw = "", fromRaw = "") {
    const hay = `${(subjectRaw || "").toLowerCase()} ${(fromRaw || "").toLowerCase()}`;
    return BLOCK_EMAIL_CHANGE.some((k) => hay.includes(k));
  }

  function norm(s) {
    return (s || "").toString().trim().toLowerCase();
  }

  /**
   * ✅ “Estrictísimo”:
   * - Si platformName = "Netflix" => SOLO pasa si subject/from contiene "netflix"
   * - Si quieres tolerancia a variantes, se agregan como extra, pero SIEMPRE
   *   tienen que incluir el nombre o una variante.
   */
  function matchesPlatformStrict(subjectRaw = "", fromRaw = "", platformName = "all") {
    const p = norm(platformName);
    if (!p || p === "all") return true;

    const subj = (subjectRaw || "").toLowerCase();
    const frm = (fromRaw || "").toLowerCase();

    // ✅ El "nombre tal cual" que pusiste en admin (normalizado) DEBE aparecer
    // EJ: "viki rakuten" => debe salir "viki" o "viki rakuten" si quieres, pero aquí pediste "que tenga la palabra"
    // Como los correos a veces no traen el nombre completo, hacemos:
    //  - Palabras principales del nombre (tokens) y aceptamos si aparece AL MENOS 1 token "significativo"
    const tokens = p
      .replace(/[^\p{L}\p{N}\s+]/gu, " ") // limpia símbolos raros, mantiene letras/números (+ para disney+)
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);

    // tokens “significativos”: evita cosas como "tv", "app", "plus" solos
    const stop = new Set(["tv", "app", "plus", "video", "stream", "streaming", "the", "of", "and"]);
    const significant = tokens.filter((t) => t.length >= 3 && !stop.has(t));

    // Si no hay tokens significativos, cae al nombre completo
    const mustMatchList = significant.length ? significant : [p];

    // ✅ Si NO aparece ninguna “palabra clave” de la plataforma => NO pasa
    const strictHit = mustMatchList.some((t) => subj.includes(t) || frm.includes(t));
    if (strictHit) return true;

    // 🔁 Variantes comunes (solo ayudan cuando la plataforma real usa otro nombre típico)
    // OJO: esto sigue siendo estricto, porque SOLO se usa si coincide la clave de esa plataforma.
    const aliases = {
      "hbo": ["hbomax", "hbo max"],
      "hbomax": ["hbo", "hbo max"],
      "disney": ["disney+", "disney plus"],
      "disney+": ["disney", "disney plus"],
      "netflix": ["netflix"],
      "prime": ["prime video", "amazon prime", "amazon prime video"],
      "amazon": ["prime video", "amazon prime", "amazon prime video"],
      "spotify": ["spotify"],
      "youtube": ["youtube", "google", "google llc"],
      "crunchyroll": ["crunchyroll"],
      "viki": ["viki", "rakuten viki", "viki rakuten"],
      "rakuten": ["rakuten", "rakuten viki", "viki"]
    };

    const extra = aliases[p] || [];
    return extra.some((a) => subj.includes(a) || frm.includes(a));
  }

  try {
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });

    const uids = await client.search({ to: `${alias}@cryxteam.com` });

    // ✅ pool reciente para filtrar y aún así conseguir 3
    const recentPool = uids.slice(-120).reverse(); // subí a 120 por si el filtro estricto es fuerte

    for (const uid of recentPool) {
      const msg = await client.fetchOne(uid, { source: true });
      const parsed = await simpleParser(msg.source);

      const subjectRaw = parsed.subject || "";
      const fromText = parsed.from?.text || "";

      // ❌ bloquear SOLO cambio de correo/email
      if (shouldBlockEmailChange(subjectRaw, fromText)) continue;

      // ✅ filtro ESTRICTO por plataforma
      if (!matchesPlatformStrict(subjectRaw, fromText, platform)) continue;

      emails.push({
        from: parsed.from?.text || null,
        to: `${alias}@cryxteam.com`,
        subject: parsed.subject || null,
        date: parsed.date || null,
        html: parsed.html || null,
        text: parsed.text || null
      });

      // ✅ SOLO 3
      if (emails.length === 3) break;
    }

    return emails;
  } catch (err) {
    console.error("❌ IMAP ERROR:", err);
    throw err;
  } finally {
    await client.logout().catch(() => {});
  }
}
