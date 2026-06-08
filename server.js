import express from "express"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.post("/api/diagnose", async (req, res) => {
  const { message, history } = req.body

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.VITE_ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: `You are an expert network and telecom engineer. Diagnose network problems clearly and concisely. Give step-by-step solutions.
      
At the END of every response, always add this exact line:
SEVERITY: LOW or SEVERITY: MEDIUM or SEVERITY: HIGH

Choose based on:
- LOW: Minor inconvenience, easy fix
- MEDIUM: Significant issue, needs attention  
- HIGH: Complete outage or critical failure`,
      messages: [
        ...history,
        { role: "user", content: message }
      ]
    })
  })

  const data = await response.json()
  const fullText = data.content[0].text

  // Extract severity
  const severityMatch = fullText.match(/SEVERITY:\s*(LOW|MEDIUM|HIGH)/i)
  const severity = severityMatch ? severityMatch[1].toUpperCase() : "MEDIUM"
  const reply = fullText.replace(/SEVERITY:\s*(LOW|MEDIUM|HIGH)/i, "").trim()

  res.json({ reply, severity })
})

app.listen(3001, () => console.log("Server running on port 3001"))