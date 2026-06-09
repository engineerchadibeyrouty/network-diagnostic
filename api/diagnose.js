export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") return res.status(405).end()

  try {
    const { message, history } = req.body

    if (!process.env.ANTHROPIC_KEY) {
      return res.status(500).json({ error: "Missing ANTHROPIC_KEY" })
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `You are an expert network and telecom engineer. Diagnose network problems clearly and concisely. Give step-by-step solutions.
        
At the END of every response, always add this exact line:
SEVERITY: LOW or SEVERITY: MEDIUM or SEVERITY: HIGH

Choose based on:
- LOW: Minor inconvenience, easy fix
- MEDIUM: Significant issue, needs attention  
- HIGH: Complete outage or critical failure`,
        messages: [
          ...(history || []),
          { role: "user", content: message }
        ]
      })
    })

    const text = await response.text()
    
    let data
    try {
      data = JSON.parse(text)
    } catch(e) {
      return res.status(500).json({ error: "Invalid JSON from Anthropic", raw: text })
    }

    if (data.error) {
      return res.status(500).json({ error: data.error.message, type: data.error.type })
    }

    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: "No content", data })
    }

    const fullText = data.content[0].text
    const severityMatch = fullText.match(/SEVERITY:\s*(LOW|MEDIUM|HIGH)/i)
    const severity = severityMatch ? severityMatch[1].toUpperCase() : "MEDIUM"
    const reply = fullText.replace(/SEVERITY:\s*(LOW|MEDIUM|HIGH)/i, "").trim()

    res.json({ reply, severity })
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack })
  }
}