import { useState, useEffect } from "react"
import { supabase } from "./supabase"
import { ArrowLeft, Plus, Send, X } from "lucide-react"

export default function Tickets({ onBack, darkMode }) {
  const [tickets, setTickets] = useState([])
  const [selected, setSelected] = useState(null)
  const [reply, setReply] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => { loadTickets() }, [])

  const loadTickets = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .order("updated_at", { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    setSending(true)

    const { data: { session } } = await supabase.auth.getSession()
    await fetch("/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        action: "reply_ticket",
        ticketId: selected.id,
        message: reply
      })
    })

    const newMsg = {
      role: "user",
      content: reply,
      created_at: new Date().toISOString()
    }
    const updated = { ...selected, messages: [...selected.messages, newMsg] }
    setSelected(updated)
    setTickets(prev => prev.map(t => t.id === selected.id ? updated : t))
    setReply("")
    setSending(false)
  }

  const bg = darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
  const cardBg = darkMode ? "bg-gray-800" : "bg-white border border-gray-200"
  const inputBg = darkMode ? "bg-gray-700 text-white placeholder-gray-400" : "bg-gray-200 text-gray-900"

  const statusColor = (s) => ({
    open: "bg-blue-500/20 text-blue-400 border-blue-700",
    in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-700",
    resolved: "bg-green-500/20 text-green-400 border-green-700"
  })[s] || ""

  const statusLabel = (s) => ({
    open: "🔵 Open",
    in_progress: "🟡 In Progress",
    resolved: "🟢 Resolved"
  })[s] || s

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${bg}`}>
      <p className="text-gray-400">Loading tickets...</p>
    </div>
  )

  return (
    <div className={`min-h-screen ${bg} p-6`}>
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition">
        <ArrowLeft size={18} /> Back
      </button>

      <h1 className="text-3xl font-bold text-blue-400 mb-2">🎫 My Tickets</h1>
      <p className="text-gray-400 mb-6">Track your support requests</p>

      {tickets.length === 0 && (
        <div className={`rounded-2xl p-12 text-center ${cardBg}`}>
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-400">No tickets yet. Open one from the chat when you need human support.</p>
        </div>
      )}

      <div className="grid gap-3">
        {tickets.map(t => (
          <div key={t.id} onClick={() => setSelected(t)}
            className={`${cardBg} rounded-2xl p-4 cursor-pointer hover:ring-2 hover:ring-blue-500 transition`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold truncate flex-1">{t.title}</p>
              <span className={`text-xs px-2 py-1 rounded-full border ml-3 flex-shrink-0 ${statusColor(t.status)}`}>
                {statusLabel(t.status)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {t.messages?.length || 0} messages • {new Date(t.updated_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Ticket Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="font-bold text-lg">{selected.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(selected.status)}`}>
                  {statusLabel(selected.status)}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages?.map((msg, i) => (
                <div key={i} className={`p-3 rounded-2xl max-w-lg ${
                  msg.role === "user"
                    ? "bg-blue-600 self-end ml-auto text-white"
                    : "bg-gray-700 text-gray-100"
                }`}>
                  <p className="text-xs text-gray-300 mb-1">
                    {msg.role === "admin" ? "🛡️ Support" : "👤 You"} • {new Date(msg.created_at).toLocaleString()}
                  </p>
                  {msg.content}
                </div>
              ))}
            </div>

            {selected.status !== "resolved" && (
              <div className="p-4 border-t border-gray-700 flex gap-2">
                <input
                  className="flex-1 bg-gray-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder="Type a reply..."
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendReply()}
                />
                <button onClick={sendReply} disabled={sending}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-xl transition text-white">
                  <Send size={16} />
                </button>
              </div>
            )}

            {selected.status === "resolved" && (
              <div className="p-4 border-t border-gray-700 text-center text-green-400 text-sm">
                ✅ This ticket has been resolved
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}