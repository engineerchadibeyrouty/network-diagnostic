import { createClient } from "@supabase/supabase-js"

const DAILY_LIMIT = 20

const LEBANON_PROVIDERS = (lat, lon) => {
  // Rough coverage zones for Lebanon
  if (lat > 33.8 && lat < 34.0 && lon > 35.4 && lon < 35.7) return "Ogero fiber / MTC Touch 4G (Beirut)"
  if (lat > 33.5 && lat < 33.8 && lon > 35.3 && lon < 35.6) return "MTC Touch / Alfa 4G (South Beirut / Chouf)"
  if (lat > 33.8 && lat < 34.2 && lon > 35.6 && lon < 36.0) return "Ogero DSL / MTC Touch (Metn / Kesrwan)"
  if (lat > 33.5 && lat < 33.9 && lon > 35.6 && lon < 36.2) return "Alfa 4G / Ogero DSL (Bekaa)"
  if (lat > 34.2 && lat < 34.6 && lon > 35.6 && lon < 36.2) return "Ogero DSL / Alfa (North Lebanon / Tripoli)"
  if (lat > 33.2 && lat < 33.5 && lon > 35.2 && lon < 35.5) return "MTC Touch / Alfa (South Lebanon / Tyre)"
  return "Lebanese ISP (Ogero / MTC Touch / Alfa)"
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") return res.status(405).end()

  try {
    const { message, history, location } = req.body

    if (!process.env.ANTHROPIC_KEY) {
      return res.status(500).json({ error: "Missing ANTHROPIC_KEY" })
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    const authHeader = req.headers.authorization

    let userId = null
    let adminClient = null

    if (authHeader && serviceKey) {
      adminClient = createClient(supabaseUrl, serviceKey)
      const { data: { user } } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""))

      if (user) {
        userId = user.id

        const { data: banned } = await adminClient
          .from("banned_users")
          .select("user_id")
          .eq("user_id", userId)
          .single()

        if (banned) {
          return res.status(403).json({ error: "Your account has been banned. Contact support." })
        }

        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const { count } = await adminClient
          .from("api_usage")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", todayStart.toISOString())

        if (count >= DAILY_LIMIT) {
          return res.status(429).json({
            error: `Daily limit of ${DAILY_LIMIT} messages reached. Try again tomorrow.`,
            remaining: 0
          })
        }

        // Save location if provided
        if (location?.latitude && location?.longitude) {
          const provider = LEBANON_PROVIDERS(location.latitude, location.longitude)
          await adminClient.from("user_locations").upsert({
            user_id: userId,
            latitude: location.latitude,
            longitude: location.longitude,
            city: location.city || null,
            region: location.region || null,
            provider,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" })
        }
      }
    }

    // Build location context for AI
    let locationContext = ""
    // Save location if provided
        if (location?.latitude && location?.longitude) {
          const provider = LEBANON_PROVIDERS(location.latitude, location.longitude)

          const { count: msgCount } = await adminClient
            .from("api_usage")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)

          await adminClient.from("user_locations").upsert({
            user_id: userId,
            latitude: location.latitude,
            longitude: location.longitude,
            city: location.city || null,
            region: location.region || null,
            provider,
            device: location.device || null,
            browser: location.browser || null,
            os: location.os || null,
            ip_address: req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || null,
            screen_size: location.screenSize || null,
            connection_type: location.connectionType || null,
            battery_level: location.batteryLevel || null,
            language: location.language || null,
            timezone: location.timezone || null,
            last_active: new Date().toISOString(),
            total_messages: msgCount || 0,
            network_speed: location.networkSpeed || null,
            cpu_cores: location.cpuCores || null,
            ram_gb: location.ramGb || null,
            touch_support: location.touchSupport || false,
            color_depth: location.colorDepth || null,
            pixel_ratio: location.pixelRatio || null,
            orientation: location.orientation || null,
            platform: location.platform || null,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" })
        }
    if (location?.latitude && location?.longitude) {
      const provider = LEBANON_PROVIDERS(location.latitude, location.longitude)
      locationContext = `
User location context:
- Country: Lebanon
- Coordinates: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}
- City/Region: ${location.city || "Unknown"}, ${location.region || "Lebanon"}
- Likely ISP/Provider: ${provider}

Lebanon-specific context:
- Ogero is the main DSL/fiber provider (state-owned)
- MTC Touch and Alfa are the two mobile operators (3G/4G)
- Common issues: power cuts affecting routers, Ogero line quality, 4G congestion
- Ogero fiber bundles: 10Mbps, 20Mbps, 50Mbps, 100Mbps
- MTC Touch 4G packages: daily/weekly/monthly data bundles
- Alfa 4G packages: similar to MTC, varies by region
`
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: `You are an expert network and telecom engineer specializing in Lebanese ISPs and telecom infrastructure. You ONLY answer questions related to networking, internet connectivity, routers, WiFi, ISPs, telecom infrastructure, and related topics.

If the user asks anything unrelated to networking or telecom, respond with: "I can only help with network and connectivity issues. Please describe your network problem."

${locationContext}

When location is available:
- Reference the user's specific provider (Ogero/MTC Touch/Alfa) in your diagnosis
- Give Lebanon-specific troubleshooting steps
- Mention relevant bundles or packages if applicable
- Consider local infrastructure issues (power cuts, Ogero line quality, etc.)

Give step-by-step solutions. Be concise and clear.

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
    } catch (e) {
      return res.status(500).json({ error: "Invalid JSON from Anthropic", raw: text })
    }

    if (data.error) return res.status(500).json({ error: data.error.message })
    if (!data.content || !data.content[0]) return res.status(500).json({ error: "No content" })

    const tokensIn = data.usage?.input_tokens || 0
    const tokensOut = data.usage?.output_tokens || 0

    let remaining = null
    if (userId && adminClient) {
      await adminClient.from("api_usage").insert({
        user_id: userId,
        tokens_in: tokensIn,
        tokens_out: tokensOut
      })

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count: newCount } = await adminClient
        .from("api_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", todayStart.toISOString())

      remaining = DAILY_LIMIT - (newCount || 0)
    }

    const fullText = data.content[0].text
    const severityMatch = fullText.match(/SEVERITY:\s*(LOW|MEDIUM|HIGH)/i)
    const severity = severityMatch ? severityMatch[1].toUpperCase() : "MEDIUM"
    const reply = fullText.replace(/SEVERITY:\s*(LOW|MEDIUM|HIGH)/i, "").trim()

    res.json({ reply, severity, remaining })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}