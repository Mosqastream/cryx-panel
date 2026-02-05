export function extractAlias(email) {
  if (!email) return null
  return email.split("@")[0].trim()
}

export function detectPlatform(subject = "", from = "", body = "") {
  const text = `${subject} ${from} ${body}`.toLowerCase()

  if (text.includes("netflix")) return "Netflix"
  if (text.includes("hbo") || text.includes("max")) return "HBO Max"
  if (text.includes("disney")) return "Disney+"
  if (text.includes("prime")) return "Prime Video"
  if (text.includes("paramount")) return "Paramount+"
  if (text.includes("star")) return "Star+"

  return null
}

export function isChangeEmail(body = "") {
  const text = body.toLowerCase()

  const triggers = [
    "cambiar correo",
    "correo actualizado",
    "change email",
    "update email"
  ]

  return triggers.some(t => text.includes(t))
}
