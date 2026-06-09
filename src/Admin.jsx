import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import {
  ArrowLeft, Users, MessageSquare, AlertTriangle, TrendingUp,
  Eye, X, Trash2, Ban, ShieldCheck, KeyRound, ChevronDown, ChevronUp
} from "lucide-react"
import ReactMarkdown from "react-markdown"

export default function Admin({ onBack }) {
  const [stats, setStats] = useState(null)
  const [conversations, setConversations] = useState([])
  const [users, setUsers] = useState({})
  const [bannedSet, setBannedSet] = useState(new Set())
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

  const loadStats = async () => {
    setLoading(true)

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false })

    const { data: userList } = await supabase
      .from("user_emails")
      .select("*")
      .order("created_at", { ascending: false })

    const { data: bannedList } = await supabase
      .from("banned_users")
      .select("user_id")

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

    setStats({
      users: userList?.length || 0,
      conversations: convs?.length || 0,
      messages: totalMessages,
      severities: severityCounts,
    })
    setConversations(convs || [])
    setUsers(userMap)
    setBannedSet(newBannedSet)
    setLoading(false)
  }

  const handleBan = async (userId) => {
    setActionLoading(prev => ({ ...prev, [`ban_${userId}`]: true }))
    const res = await adminAction("ban_user", { userId, reason: "Banned by admin" })
    if (res.success) {
      setBannedSet(prev => new Set([...prev, userId]))
      showToast("User banned.")
    } else {
      showToast(res.error || "Failed to ban user.", "error")
    }
    setActionLoading(prev => ({ ...prev, [`ban_${userId}`]: false }))
  }

  const handleUnban = async (userId) => {
    setActionLoading(prev => ({ ...prev, [`ban_${userId}`]: true }))
    const res = await adminAction("unban_user", { userId })
    if (res.success) {
      setBannedSet(prev => { const s = new Set(prev); s.delete(userId); return s })
      showToast("User unbanned.")
    } else {
      showToast(res.error || "Failed to unban user.", "error")
    }
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
    } else {
      showToast(res.error || "Failed to delete user.", "error")
    }
    setActionLoading(prev => ({ ...prev, [`delete_${userId}`]: false }))
  }

  const handleResetPassword = async (email) => {
    setActionLoading(prev => ({ ...prev, [`reset_${email}`]: true }))
    const res = await adminAction("reset_password", { email })
    if (res.success) {
      showToast("Password reset email sent.")
    } else {
      showToast(res.error || "Failed to send reset email.", "error")
    }
    setActionLoading(prev => ({ ...prev, [`reset_${email}`]: false }))
  }

  const getUserEmail = (userId) => users[userId]?.email || "Unknown"

  if (loading) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-gray-400">Loading dashboard...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">

      {/* Toast */}
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

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {["overview", "users", "conversations"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition capitalize ${
              activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Users />} label="Total Users" value={stats.users} color="blue" />
            <StatCard icon={<MessageSquare />} label="Conversations" value={stats.conversations} color="purple" />
            <StatCard icon={<TrendingUp />} label="Messages" value={stats.messages} color="green" />
            <StatCard icon={<AlertTriangle />} label="Critical Issues" value={stats.severities.HIGH} color="red" />
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

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="bg-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">All Users ({Object.keys(users).length})</h2>
          <div className="space-y-2">
            {Object.values(users).map(u => {
              const isBanned = bannedSet.has(u.id)
              const userConvos = conversations.filter(c => c.user_id === u.id)
              const userMsgs = userConvos.reduce((sum, c) => sum + (c.messages?.length || 0), 0)
              const isExpanded = expandedUser === u.id

              return (
                <div key={u.id} className={`rounded-xl border transition ${isBanned ? "border-red-800 bg-gray-700/60" : "border-transparent bg-gray-700"}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isBanned ? "bg-red-500" : "bg-green-500"}`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.email}</p>
                        <p className="text-xs text-gray-400">
                          ID: {u.id.slice(0, 8)}... • Joined: {new Date(u.created_at).toLocaleDateString()} • {userConvos.length} chats • {userMsgs} msgs
                          {isBanned && <span className="ml-2 text-red-400 font-semibold">BANNED</span>}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      className="ml-4 text-gray-400 hover:text-white transition flex-shrink-0"
                    >
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

      {/* Conversations Tab */}
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

      {/* Chat Viewer Modal */}
      {selectedConvo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="font-bold text-lg">{selectedConvo.title}</h3>
                <p className="text-xs text-gray-400">
                  {selectedConvo.messages?.length || 0} messages • 👤 {getUserEmail(selectedConvo.user_id)} • {new Date(selectedConvo.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedConvo(null)} className="text-gray-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedConvo.messages?.length === 0 && (
                <p className="text-gray-500 text-center mt-8">No messages in this conversation.</p>
              )}
              {selectedConvo.messages?.map((msg, i) => (
                <div key={i} className={`p-3 rounded-2xl max-w-xl ${
                  msg.role === "user" ? "bg-blue-600 self-end ml-auto text-white" : "bg-gray-700 text-gray-100"
                }`}>
                  {msg.role === "assistant" && selectedConvo.severities?.[i] && (
                    <div className={`text-xs font-bold px-2 py-1 rounded-full inline-block mb-2 ${
                      selectedConvo.severities[i] === "HIGH" ? "bg-red-500 text-white" :
                      selectedConvo.severities[i] === "MEDIUM" ? "bg-yellow-500 text-black" :
                      "bg-green-500 text-black"
                    }`}>
                      {selectedConvo.severities[i] === "HIGH" ? "🔴 CRITICAL" :
                       selectedConvo.severities[i] === "MEDIUM" ? "🟡 MEDIUM" : "🟢 LOW"}
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <ReactMarkdown components={{
                      h1: ({node, ...props}) => <h1 className="text-xl font-bold text-blue-400 mb-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-lg font-bold text-blue-400 mb-2 mt-3" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-md font-semibold text-blue-300 mb-1 mt-2" {...props} />,
                      p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li {...props} />,
                      code: ({node, inline, ...props}) => inline
                        ? <code className="bg-gray-900 text-green-400 px-1 rounded text-sm" {...props} />
                        : <code className="block bg-gray-900 text-green-400 p-3 rounded-lg text-sm my-2 overflow-x-auto" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                    }}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : msg.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionButton({ icon, label, color, loading, onClick }) {
  const colors = {
    red:    "bg-red-600/20 hover:bg-red-600 border-red-700 text-red-400 hover:text-white",
    yellow: "bg-yellow-600/20 hover:bg-yellow-600 border-yellow-700 text-yellow-400 hover:text-white",
    green:  "bg-green-600/20 hover:bg-green-600 border-green-700 text-green-400 hover:text-white",
    blue:   "bg-blue-600/20 hover:bg-blue-600 border-blue-700 text-blue-400 hover:text-white",
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-50 ${colors[color]}`}>
      {loading
        ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : icon}
      {label}
    </button>
  )
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue:   "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    green:  "text-green-400 bg-green-500/10",
    red:    "text-red-400 bg-red-500/10",
  }
  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  )
}

function SeverityBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total * 100).toFixed(1) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-gray-400">{count} ({pct}%)</span>
      </div>
      <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}