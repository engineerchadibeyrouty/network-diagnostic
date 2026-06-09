import { createClient } from "@supabase/supabase-js"

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") return res.status(405).end()

  try {
    const { action, ticketId, title, conversationId, message, status, priority } = req.body
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: "No auth token" })

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: { user } } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""))
    if (!user) return res.status(401).json({ error: "Invalid token" })

    const { data: adminCheck } = await adminClient
      .from("admins").select("user_id").eq("user_id", user.id).single()
    const isAdmin = !!adminCheck

    // Create ticket
    if (action === "create_ticket") {
      const newMsg = {
        role: "user",
        content: message,
        email: user.email,
        created_at: new Date().toISOString()
      }
      const { data, error } = await adminClient.from("tickets").insert({
        user_id: user.id,
        user_email: user.email,
        conversation_id: conversationId || null,
        title,
        messages: [newMsg],
        status: "open",
        priority: priority || "medium"
      }).select().single()

      if (error) return res.status(500).json({ error: error.message })

      // Notify admins via email
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `🎫 New Ticket: ${title}`,
        html: `
          <h2>New support ticket opened</h2>
          <p><b>From:</b> ${user.email}</p>
          <p><b>Title:</b> ${title}</p>
          <p><b>Message:</b> ${message}</p>
          <p><a href="${process.env.SITE_URL}">View in dashboard</a></p>
        `
      })

      return res.json({ success: true, ticket: data })
    }

    // Reply to ticket
    if (action === "reply_ticket") {
      const { data: ticket } = await adminClient
        .from("tickets").select("*").eq("id", ticketId).single()

      if (!ticket) return res.status(404).json({ error: "Ticket not found" })
      if (!isAdmin && ticket.user_id !== user.id)
        return res.status(403).json({ error: "Forbidden" })

      const newMsg = {
        role: isAdmin ? "admin" : "user",
        content: message,
        email: user.email,
        created_at: new Date().toISOString()
      }

      const updatedMessages = [...(ticket.messages || []), newMsg]
      const newStatus = isAdmin ? "in_progress" : ticket.status

      await adminClient.from("tickets").update({
        messages: updatedMessages,
        status: newStatus,
        updated_at: new Date().toISOString()
      }).eq("id", ticketId)

      // Send email notification
      if (isAdmin) {
        // Admin replied → notify user
        await sendEmail({
          to: ticket.user_email,
          subject: `💬 Reply to your ticket: ${ticket.title}`,
          html: `
            <h2>You have a new reply on your support ticket</h2>
            <p><b>Ticket:</b> ${ticket.title}</p>
            <p><b>Reply:</b> ${message}</p>
            <p><a href="${process.env.SITE_URL}">View your ticket</a></p>
          `
        })
      } else {
        // User replied → notify admin
        await sendEmail({
          to: process.env.ADMIN_EMAIL,
          subject: `💬 User replied on ticket: ${ticket.title}`,
          html: `
            <h2>User replied to a ticket</h2>
            <p><b>From:</b> ${user.email}</p>
            <p><b>Ticket:</b> ${ticket.title}</p>
            <p><b>Reply:</b> ${message}</p>
            <p><a href="${process.env.SITE_URL}">View in dashboard</a></p>
          `
        })
      }

      return res.json({ success: true })
    }

    // Update status
    if (action === "update_status") {
      if (!isAdmin) return res.status(403).json({ error: "Admins only" })
      await adminClient.from("tickets").update({
        status,
        updated_at: new Date().toISOString()
      }).eq("id", ticketId)
      return res.json({ success: true })
    }

    return res.status(400).json({ error: "Unknown action" })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY || !to) return
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: "NetDiag <noreply@resend.dev>",
      to,
      subject,
      html
    })
  })
}