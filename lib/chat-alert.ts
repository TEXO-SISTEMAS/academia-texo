export async function sendChatAlert(title: string, lines: Record<string, string>) {
  const url = process.env.GOOGLE_CHAT_WEBHOOK_URL
  if (!url) return

  const body = Object.entries(lines)
    .map(([k, v]) => `• *${k}:* ${v}`)
    .join('\n')

  const text = `🚨 *${title}*\n${body}`

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {})
}
