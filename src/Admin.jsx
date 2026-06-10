import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import {
  ArrowLeft, Users, MessageSquare, AlertTriangle, TrendingUp,
  Eye, X, Trash2, Ban, ShieldCheck, KeyRound, ChevronDown, ChevronUp, Zap, Send, MapPin
} from "lucide-react"
import ReactMarkdown from "react-markdown"

const PRICE_IN = 0.80 / 1_000_000
const PRICE_OUT = 4.00 / 1_000_000
const BUDGET_USD = 10.00

export default function Admin({ onBack }) {
  const [stats, setStats] = useState(null)
  const [conversations, setConversations] = useState([])
  const [users, setUsers] = useState({})
  const [bannedSet, setBannedSet] = useState(new Set())
  const [usageData, setUsageData] = useState({ tokensIn: 0, tokensOut: 0, cost: 0 })
  const [tickets, setTickets] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [adminReply, setAdminReply] = useState("")
  const [replySending, setReplySending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedConvo, setSelectedConvo] = useState(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [actionLoading, setActionLoading] = useState({})
  const [toast, setToast] = useState(null)
  const [expandedUser, setExpandedUser] = useState(null)

  useEffect(() => { loadStats() }, [])

  const showToast = (msg, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const adminAction = async (action, params = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ action, ...params })
    })
    return res.json()
  }

  const ticketAction = async (action, params = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ action, ...params })
    })
    return res.json()
  }

  const loadStats = async () => {
    setLoading(true)

    const { data: convs } = await supabase
      .from("conversations").select("*").order("created_at", { ascending: false })

    const { data: userList } = await supabase
      .from("user_emails").select("*").order("created_at", { ascending: false })

    const { data: bannedList } = await supabase
      .from("banned_users").select("user_id")

    const { data: usage } = await supabase
      .from("api_usage").select("tokens_in, tokens_out")

    const { data: ticketList } = await supabase
      .from("tickets").select("*").order("updated_at", { ascending: false })

    const { data: locationList } = await supabase
      .from("user_locations").select("*")

    const userMap = {}
    userList?.forEach(u => { userMap[u.id] = u })

    const newBannedSet = new Set(bannedList?.map(b => b.user_id) || [])

    const totalMessages = convs?.reduce((sum, c) => sum + (c.messages?.length || 0), 0) || 0
    const severityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 }
    convs?.forEach(c => {
      Object.values(c.severities || {}).forEach(s => {
        if (severityCounts[s] !== undefined) severityCounts[s]++
      })
    })

    const totalIn = usage?.reduce((s, r) => s + (r.tokens_in || 0), 0) || 0
    const totalOut = usage?.reduce((s, r) => s + (r.tokens_out || 0), 0) || 0
    const totalCost = totalIn * PRICE_IN + totalOut * PRICE_OUT

    setStats({ users: userList?.length || 0, conversations: convs?.length || 0, messages: totalMessages, severities: severityCounts })
    setUsageData({ tokensIn: totalIn, tokensOut: totalOut, cost: totalCost })
    setConversations(convs || [])
    setUsers(userMap)
    setBannedSet(newBannedSet)
    setTickets(ticketList || [])
    setLocations(locationList || [])
    setLoading(false)
  }

  const handleBan = async (userId) => {
    setActionLoading(prev => ({ ...prev, [`ban_${userId}`]: true }))
    const res = await adminAction("ban_user", { userId, reason: "Banned by admin" })
    if (res.success) { setBannedSet(prev => new Set([...prev, userId])); showToast("User banned.") }
    else showToast(res.error || "Failed.", "error")
    setActionLoading(prev => ({ ...prev, [`ban_${userId}`]: false }))
  }

  const handleUnban = async (userId) => {
    setActionLoading(prev => ({ ...prev, [`ban_${userId}`]: true }))
    const res = await adminAction("unban_user", { userId })
    if (res.success) { setBannedSet(prev => { const s = new Set(prev); s.delete(userId); return s }); showToast("User unbanned.") }
    else showToast(res.error || "Failed.", "error")
    setActionLoading(prev => ({ ...prev, [`ban_${userId}`]: false }))
  }

  const handleDelete = async (userId) => {
    if (!window.confirm("Permanently delete this user and all their data?")) return
    setActionLoading(prev => ({ ...prev, [`delete_${userId}`]: true }))
    const res = await adminAction("delete_user", { userId })
    if (res.success) {
      setUsers(prev => { const u = { ...prev }; delete u[userId]; return u })
      setConversations(prev => prev.filter(c => c.user_id !== userId))
      showToast("User deleted.")
    } else showToast(res.error || "Failed.", "error")
    setActionLoading(prev => ({ ...prev, [`delete_${userId}`]: false }))
  }

  const handleResetPassword = async (email) => {
    setActionLoading(prev => ({ ...prev, [`reset_${email}`]: true }))
    const res = await adminAction("reset_password", { email })
    if (res.success) showToast("Password reset email sent.")
    else showToast(res.error || "Failed.", "error")
    setActionLoading(prev => ({ ...prev, [`reset_${email}`]: false }))
  }

  const sendAdminReply = async () => {
    if (!adminReply.trim() || !selectedTicket) return
    setReplySending(true)
    const res = await ticketAction("reply_ticket", { ticketId: selectedTicket.id, message: adminReply })
    if (res.success) {
      const newMsg = { role: "admin", content: adminReply, created_at: new Date().toISOString() }
      const updated = { ...selectedTicket, messages: [...selectedTicket.messages, newMsg], status: "in_progress" }
      setSelectedTicket(updated)
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t))
      setAdminReply("")
      showToast("Reply sent.")
    } else showToast(res.error || "Failed.", "error")
    setReplySending(false)
  }

  const resolveTicket = async (ticketId) => {
    const res = await ticketAction("update_status", { ticketId, status: "resolved" })
    if (res.success) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: "resolved" } : t))
      if (selectedTicket?.id === ticketId) setSelectedTicket(prev => ({ ...prev, status: "resolved" }))
      showToast("Ticket resolved.")
    }
  }

  const getUserEmail = (userId) => users[userId]?.email || "Unknown"
  const creditsRemaining = Math.max(0, BUDGET_USD - usageData.cost)
  const budgetUsedPct = Math.min(100, (usageData.cost / BUDGET_USD) * 100)
  const openTickets = tickets.filter(t => t.status !== "resolved").length

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

  // Provider stats
  const providerCounts = locations.reduce((acc, l) => {
    const p = l.provider || "Unknown"
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {})

  if (loading) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-gray-400">Loading dashboard...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">

      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-medium text-sm ${
          toast.type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition">
        <ArrowLeft size={18} /> Back to app
      </button>

      <h1 className="text-4xl font-bold text-blue-400 mb-2">🛡️ Admin Dashboard</h1>
      <p className="text-gray-400 mb-6">System-wide statistics and user management</p>

      <div className="flex gap-2 mb-8 flex-wrap">
        {["overview", "users", "conversations", "tickets", "locations"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition capitalize flex items-center gap-2 ${
              activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}>
            {tab === "tickets" && openTickets > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {openTickets}
              </span>
            )}
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard icon={<Users />} label="Total Users" value={stats.users} color="blue" />
            <StatCard icon={<MessageSquare />} label="Conversations" value={stats.conversations} color="purple" />
            <StatCard icon={<TrendingUp />} label="Messages" value={stats.messages} color="green" />
            <StatCard icon={<AlertTriangle />} label="Critical Issues" value={stats.severities.HIGH} color="red" />
          </div>

          <div className="bg-gray-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={20} className="text-yellow-400" />
              <h2 className="text-xl font-bold">API Credits</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div><p className="text-xs text-gray-400 mb-1">Budget</p><p className="text-xl font-bold">${BUDGET_USD.toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-400 mb-1">Spent</p><p className="text-xl font-bold text-orange-400">${usageData.cost.toFixed(4)}</p></div>
              <div><p className="text-xs text-gray-400 mb-1">Remaining</p><p className={`text-xl font-bold ${creditsRemaining < 1 ? "text-red-400" : "text-green-400"}`}>${creditsRemaining.toFixed(4)}</p></div>
              <div><p className="text-xs text-gray-400 mb-1">Total Tokens</p><p className="text-xl font-bold text-blue-400">{(usageData.tokensIn + usageData.tokensOut).toLocaleString()}</p></div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Budget used</span><span>{budgetUsedPct.toFixed(1)}%</span>
            </div>
            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${budgetUsedPct > 80 ? "bg-red-500" : budgetUsedPct > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                style={{ width: `${budgetUsedPct}%` }} />
            </div>
            <div className="flex gap-6 mt-4 text-xs text-gray-500">
              <span>Input: {usageData.tokensIn.toLocaleString()} (${(usageData.tokensIn * PRICE_IN).toFixed(4)})</span>
              <span>Output: {usageData.tokensOut.toLocaleString()} (${(usageData.tokensOut * PRICE_OUT).toFixed(4)})</span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Severity Distribution</h2>
            <div className="space-y-3">
              <SeverityBar label="🔴 Critical" count={stats.severities.HIGH} total={stats.messages} color="bg-red-500" />
              <SeverityBar label="🟡 Medium" count={stats.severities.MEDIUM} total={stats.messages} color="bg-yellow-500" />
              <SeverityBar label="🟢 Low" count={stats.severities.LOW} total={stats.messages} color="bg-green-500" />
            </div>
          </div>
        </>
      )}

      {/* Users */}
      {activeTab === "users" && (
        <div className="bg-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">All Users ({Object.keys(users).length})</h2>
          <div className="space-y-2">
            {Object.values(users).map(u => {
              const isBanned = bannedSet.has(u.id)
              const userConvos = conversations.filter(c => c.user_id === u.id)
              const userMsgs = userConvos.reduce((sum, c) => sum + (c.messages?.length || 0), 0)
              const userLoc = locations.find(l => l.user_id === u.id)
              const isExpanded = expandedUser === u.id
              return (
                <div key={u.id} className={`rounded-xl border transition ${isBanned ? "border-red-800 bg-gray-700/60" : "border-transparent bg-gray-700"}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isBanned ? "bg-red-500" : "bg-green-500"}`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.email}</p>
                        <p className="text-xs text-gray-400">
                          {userConvos.length} chats • {userMsgs} msgs
                          {userLoc && <span className="ml-2 text-blue-400">📍 {userLoc.city || "Lebanon"} — {userLoc.provider?.split("(")[0].trim()}</span>}
                          {isBanned && <span className="ml-2 text-red-400 font-semibold">BANNED</span>}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      className="ml-4 text-gray-400 hover:text-white transition flex-shrink-0">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-gray-600 pt-3">
                      {isBanned ? (
                        <ActionButton icon={<ShieldCheck size={14} />} label="Unban" color="green"
                          loading={actionLoading[`ban_${u.id}`]} onClick={() => handleUnban(u.id)} />
                      ) : (
                        <ActionButton icon={<Ban size={14} />} label="Ban" color="yellow"
                          loading={actionLoading[`ban_${u.id}`]} onClick={() => handleBan(u.id)} />
                      )}
                      <ActionButton icon={<KeyRound size={14} />} label="Reset Password" color="blue"
                        loading={actionLoading[`reset_${u.email}`]} onClick={() => handleResetPassword(u.email)} />
                      <ActionButton icon={<Trash2 size={14} />} label="Delete User" color="red"
                        loading={actionLoading[`delete_${u.id}`]} onClick={() => handleDelete(u.id)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Conversations */}
      {activeTab === "conversations" && (
        <div className="bg-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">All Conversations ({conversations.length})</h2>
          <div className="space-y-2">
            {conversations.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-xl hover:bg-gray-600 transition">
                <div className="flex-1 truncate">
                  <p className="font-medium truncate">{c.title}</p>
                  <p className="text-xs text-gray-400">{c.messages?.length || 0} messages • 👤 {getUserEmail(c.user_id)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</p>
                  <button onClick={() => setSelectedConvo(c)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded-lg flex items-center gap-1 transition">
                    <Eye size={14} /> View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tickets */}
      {activeTab === "tickets" && (
        <div className="bg-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">All Tickets ({tickets.length})</h2>
          <div className="space-y-2">
            {tickets.length === 0 && <p className="text-gray-400 text-center py-8">No tickets yet.</p>}
            {tickets.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-xl hover:bg-gray-600 transition">
                <div className="flex-1 truncate">
                  <p className="font-medium truncate">{t.title}</p>
                  <p className="text-xs text-gray-400">👤 {t.user_email} • {t.messages?.length || 0} messages • {new Date(t.updated_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full border ${statusColor(t.status)}`}>{statusLabel(t.status)}</span>
                  <button onClick={() => setSelectedTicket(t)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded-lg flex items-center gap-1 transition">
                    <Eye size={14} /> Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations */}
      {activeTab === "locations" && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={20} className="text-blue-400" />
              <h2 className="text-xl font-bold">User Locations ({locations.length} users sharing)</h2>
            </div>

            {/* Provider breakdown */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Provider Distribution</h3>
              <div className="space-y-2">
                {Object.entries(providerCounts).map(([provider, count]) => (
                  <div key={provider}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="truncate text-gray-300">{provider}</span>
                      <span className="text-gray-400 ml-2">{count} user{count > 1 ? "s" : ""}</span>
                    </div>
                    <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all"
                        style={{ width: `${(count / locations.length) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User list with locations */}
            <h3 className="text-sm font-semibold text-gray-400 mb-3">User Location Details</h3>
            <div className="space-y-2">
              {locations.length === 0 && (
                <p className="text-gray-400 text-center py-8">No users have shared their location yet.</p>
              )}
              {locations.map(loc => (
                <div key={loc.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin size={14} className="text-blue-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{getUserEmail(loc.user_id)}</p>
                      <p className="text-xs text-gray-400">
                        {loc.city || "Unknown city"}, {loc.region || "Lebanon"} •
                        {loc.provider} •
                        {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 flex-shrink-0 ml-3">
                    {new Date(loc.updated_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Open in Google Maps button */}
            {locations.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">View individual locations:</p>
                <div className="flex flex-wrap gap-2">
                  {locations.map(loc => (
                    
                      key={loc.id}
                      href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-blue-400 hover:text-blue-300 transition"
                    >
                      📍 {loc.city || getUserEmail(loc.user_id).split("@")[0]}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conversation Modal */}
      {selectedConvo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="font-bold text-lg">{selectedConvo.title}</h3>
                <p className="text-xs text-gray-400">{selectedConvo.messages?.length || 0} messages • 👤 {getUserEmail(selectedConvo.user_id)}</p>
              </div>
              <button onClick={() => setSelectedConvo(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedConvo.messages?.map((msg, i) => (
                <div key={i} className={`p-3 rounded-2xl max-w-xl ${msg.role === "user" ? "bg-blue-600 self-end ml-auto text-white" : "bg-gray-700 text-gray-100"}`}>
                  {msg.role === "assistant" && selectedConvo.severities?.[i] && (
                    <div className={`text-xs font-bold px-2 py-1 rounded-full inline-block mb-2 ${
                      selectedConvo.severities[i] === "HIGH" ? "bg-red-500 text-white" :
                      selectedConvo.severities[i] === "MEDIUM" ? "bg-yellow-500 text-black" : "bg-green-500 text-black"
                    }`}>
                      {selectedConvo.severities[i] === "HIGH" ? "🔴 CRITICAL" : selectedConvo.severities[i] === "MEDIUM" ? "🟡 MEDIUM" : "🟢 LOW"}
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <ReactMarkdown components={{
                      p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                      code: ({node, inline, ...props}) => inline
                        ? <code className="bg-gray-900 text-green-400 px-1 rounded text-sm" {...props} />
                        : <code className="block bg-gray-900 text-green-400 p-3 rounded-lg text-sm my-2" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                    }}>{msg.content}</ReactMarkdown>
                  ) : msg.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ticket Reply Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="font-bold text-lg">{selectedTicket.title}</h3>
                <p className="text-xs text-gray-400">👤 {selectedTicket.user_email}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedTicket.status !== "resolved" && (
                  <button onClick={() => resolveTicket(selectedTicket.id)}
                    className="bg-green-600/20 hover:bg-green-600 border border-green-700 text-green-400 hover:text-white text-xs px-3 py-1 rounded-lg transition">
                    ✅ Mark Resolved
                  </button>
                )}
                <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedTicket.messages?.map((msg, i) => (
                <div key={i} className={`p-3 rounded-2xl max-w-lg ${msg.role === "admin" ? "bg-blue-600 self-end ml-auto text-white" : "bg-gray-700 text-gray-100"}`}>
                  <p className="text-xs text-gray-300 mb-1">
                    {msg.role === "admin" ? "🛡️ You (Admin)" : "👤 User"} • {new Date(msg.created_at).toLocaleString()}
                  </p>
                  {msg.content}
                </div>
              ))}
            </div>
            {selectedTicket.status !== "resolved" ? (
              <div className="p-4 border-t border-gray-700 flex gap-2">
                <input
                  className="flex-1 bg-gray-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder="Type your reply..."
                  value={adminReply}
                  onChange={e => setAdminReply(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendAdminReply()}
                />
                <button onClick={sendAdminReply} disabled={replySending}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-xl transition text-white">
                  {replySending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" /> : <Send size={16} />}
                </button>
              </div>
            ) : (
              <div className="p-4 border-t border-gray-700 text-center text-green-400 text-sm">✅ This ticket has been resolved</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionButton({ icon, label, color, loading, onClick }) {
  const colors = {
    red: "bg-red-600/20 hover:bg-red-600 border-red-700 text-red-400 hover:text-white",
    yellow: "bg-yellow-600/20 hover:bg-yellow-600 border-yellow-700 text-yellow-400 hover:text-white",
    green: "bg-green-600/20 hover:bg-green-600 border-green-700 text-green-400 hover:text-white",
    blue: "bg-blue-600/20 hover:bg-blue-600 border-blue-700 text-blue-400 hover:text-white",
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-50 ${colors[color]}`}>
      {loading ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {label}
    </button>
  )
}

function StatCard({ icon, label, value, color }) {
  const colors = { blue: "text-blue-400 bg-blue-500/10", purple: "text-purple-400 bg-purple-500/10", green: "text-green-400 bg-green-500/10", red: "text-red-400 bg-red-500/10" }
  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>{icon}</div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  )
}

function SeverityBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total * 100).toFixed(1) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="text-gray-400">{count} ({pct}%)</span></div>
      <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}