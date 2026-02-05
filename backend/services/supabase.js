import { createClient } from '@supabase/supabase-js'
import { CONFIG } from '../config/env.js'

export const supabase = createClient(
  CONFIG.SUPABASE.url,
  CONFIG.SUPABASE.serviceRole
)

export async function getMailAliasId(alias) {
  const { data, error } = await supabase
    .from('mail_alias')
    .select('id')
    .eq('alias', alias)
    .single()

  if (error || !data) return null
  return data.id
}

export async function getPlatformId(name) {
  const { data, error } = await supabase
    .from('platforms')
    .select('id')
    .eq('name', name)
    .single()

  if (error || !data) return null
  return data.id
}

export async function insertMessageToDB(msg) {
  const { error } = await supabase
    .from('messages')
    .insert({
      mail_alias_id: msg.mailAliasId,
      platform_id: msg.platformId,
      subject: msg.subject,
      content: msg.content,
      from_email: msg.fromEmail
    })

  if (error) console.error("❌ Error guardando mensaje:", error)
}
