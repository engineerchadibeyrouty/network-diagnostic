import { createClient } from "@supabase/supabase-js"

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") return res.status(405).end()

  try {
    const { action, userId, reason, email } = req.body
    const authHeader = req.headers.authorization

    if (!authHeader) return res.status(401).json({ error: "No auth token" })

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY

    // Verify the caller is admin
    const userClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY)
    const { data: { user } } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""))
    if (!user) return res.status(401).json({ error: "Invalid token" })

    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: adminCheck } = await adminClient.from("admins").select("user_id").eq("user_id", user.id).single()
    if (!adminCheck) return res.status(403).json({ error: "Not an admin" })

    if (action === "reset_password") {
      const { error } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: email,
      })
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ success: true, message: "Password reset email sent" })
    }

    if (action === "ban_user") {
      await adminClient.from("banned_users").upsert({ user_id: userId, reason: reason || "Banned by admin" })
      return res.json({ success: true, message: "User banned" })
    }

    if (action === "unban_user") {
      await adminClient.from("banned_users").delete().eq("user_id", userId)
      return res.json({ success: true, message: "User unbanned" })
    }

    if (action === "delete_user") {
      await adminClient.from("conversations").delete().eq("user_id", userId)
      await adminClient.from("banned_users").delete().eq("user_id", userId)
      await adminClient.from("admins").delete().eq("user_id", userId)
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ success: true, message: "User deleted" })
    }

    return res.status(400).json({ error: "Unknown action" })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}