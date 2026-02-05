import { ImapFlow } from 'imapflow'
import { CONFIG } from '../config/env.js'
import { extractAlias, detectPlatform, isChangeEmail } from './parser.js'
import { insertMessageToDB, getMailAliasId, getPlatformId } from './supabase.js'

export async function connectIMAP() {
  const client = new ImapFlow({
    host: CONFIG.IMAP.host,
    port: CONFIG.IMAP.port,
    secure: CONFIG.IMAP.secure,
    auth: {
      user: CONFIG.IMAP.user,
      pass: CONFIG.IMAP.pass
    }
  })

  await client.connect()
  console.log("📬 IMAP conectado")

  return client
}

export async function checkInbox(client) {
  await client.mailboxOpen('INBOX')

  let lock = await client.getMailboxLock('INBOX')
  try {
    // buscamos mensajes no borrados
    const messages = await client.search({ seen: false })

    for (let seq of messages) {
      const msg = await client.fetchOne(seq, { source: true, envelope: true })

      const subject = msg.envelope.subject || ""
      const from = msg.envelope.from?.[0]?.address || ""
      const to = msg.envelope.to?.[0]?.address || ""

      const raw = msg.source.toString()
      const body = raw.toLowerCase()

      // 1. EXTRAER ALIAS
      const alias = extractAlias(to)
      if (!alias) {
        console.log("❓ No se pudo extraer alias del destinatario:", to)
        continue
      }

      // 2. DETECTAR PLATAFORMA
      const platformName = detectPlatform(subject, from, body)
      if (!platformName) {
        console.log("❓ Plataforma desconocida:", subject)
        continue
      }

      // 3. FILTRAR CAMBIAR CORREO
      if (isChangeEmail(body)) {
        console.log("🚫 Ignorado (cambiar correo):", subject)
        continue
      }

      // 4. RESOLVER MAIL_ALIAS_ID EN DB
      const mailAliasId = await getMailAliasId(alias)
      if (!mailAliasId) {
        console.log("⚠ No hay mail_alias asignado para:", alias)
        continue
      }

      // 5. RESOLVER PLATFORM_ID EN DB
      const platformId = await getPlatformId(platformName)
      if (!platformId) {
        console.log("⚠ Plataforma no existe en DB:", platformName)
        continue
      }

      // 6. GUARDAR EN DB
      await insertMessageToDB({
        mailAliasId,
        platformId,
        subject,
        fromEmail: from,
        content: raw
      })

      console.log(`💾 Guardado: alias=${alias} platform=${platformName}`)
    }

  } finally {
    lock.release()
  }
}
