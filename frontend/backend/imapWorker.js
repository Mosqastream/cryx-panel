import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/**
 * 🔥 FUNCIÓN PRINCIPAL
 * - Devuelve SOLO 3 correos
 * - BLOQUEA SOLO correos de "cambiar correo/email" (ES/EN/PT)
 * - Filtra por plataforma (cualquiera que agregues en tu panel)
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

  // Normaliza nombre de plataforma para comparar
  function norm(s) {
    return (s || "").toString().trim().toLowerCase();
  }

  // Match por plataforma: from/subject contiene el nombre (o variantes comunes)
  function matchesPlatform(subjectRaw = "", fromRaw = "", platformName = "all") {
    const p = norm(platformName);
    if (!p || p === "all") return true;

    const subj = (subjectRaw || "").toLowerCase();
    const frm = (fromRaw || "").toLowerCase();

    // Match directo
    if (subj.includes(p) || frm.includes(p)) return true;

    // Variantes comunes (puedes añadir más si quieres)
    const aliases = {
      "hbo": ["hbomax", "hbo max"],
      "disney": ["disney+", "disney plus"],
      "netflix": ["netflix"],
      "prime": ["prime video", "amazon prime", "amazon prime video"],
      "amazon": ["prime video", "amazon prime", "amazon prime video"],
      "spotify": ["spotify"]
    };

    const extra = aliases[p] || [];
    return extra.some((a) => subj.includes(a) || frm.includes(a));
  }

  try {
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });

    const uids = await client.search({ to: `${alias}@cryxteam.com` });

    // ✅ Revisamos un pool reciente para poder filtrar y aún así obtener 3
    const recentPool = uids.slice(-80).reverse(); // últimos 80, recientes primero

    for (const uid of recentPool) {
      const msg = await client.fetchOne(uid, { source: true });
      const parsed = await simpleParser(msg.source);

      const subjectRaw = parsed.subject || "";
      const fromText = parsed.from?.text || "";

      // ❌ BLOQUEAR SOLO "cambio de correo/email"
      if (shouldBlockEmailChange(subjectRaw, fromText)) continue;

      // 🎯 Filtrar por plataforma (la que tú le pases)
      if (!matchesPlatform(subjectRaw, fromText, platform)) continue;

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
