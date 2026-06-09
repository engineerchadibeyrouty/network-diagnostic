import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import { ArrowLeft, Users, MessageSquare, AlertTriangle, TrendingUp, Eye, X } from "lucide-react"
import ReactMarkdown from "react-markdown"

export default function Admin({ onBack }) {
  const [stats, setStats] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedConvo, setSelectedConvo] = useState(null)

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    setLoading(true)

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false })

    const userIds = [...new Set(convs?.map(c => c.user_id))]
    const totalMessages = convs?.reduce((sum, c) => sum + (c.messages?.length || 0), 0) || 0

    const severityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 }
    convs?.forEach(c => {
      Object.values(c.severities || {}).forEach(s => {
        if (severityCounts[s] !== undefined) severityCounts[s]++
      })
    })

    setStats({
      users: userIds.length,
      conversations: convs?.length || 0,
      messages: totalMessages,
      severities: severityCounts,
    })
    setConversations(convs || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-gray-400">Loading dashboard...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition">
        <ArrowLeft size={18} /> Back to app
      </button>

      <h1 className="text-4xl font-bold text-blue-400 mb-2">🛡️ Admin Dashboard</h1>
      <p className="text-gray-400 mb-8">System-wide statistics and monitoring</p>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users />} label="Total Users" value={stats.users} color="blue" />
        <StatCard icon={<MessageSquare />} label="Conversations" value={stats.conversations} color="purple" />
        <StatCard icon={<TrendingUp />} label="Messages" value={stats.messages} color="green" />
        <StatCard icon={<AlertTriangle />} label="Critical Issues" value={stats.severities.HIGH} color="red" />
      </div>

      {/* Severity Breakdown */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Severity Distribution</h2>
        <div className="space-y-3">
          <SeverityBar label="🔴 Critical" count={stats.severities.HIGH} total={stats.messages} color="bg-red-500" />
          <SeverityBar label="🟡 Medium" count={stats.severities.MEDIUM} total={stats.messages} color="bg-yellow-500" />
          <SeverityBar label="🟢 Low" count={stats.severities.LOW} total={stats.messages} color="bg-green-500" />
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4">All Conversations</h2>
        <div className="space-y-2">
          {conversations.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-xl hover:bg-gray-600 transition">
              <div className="flex-1 truncate">
                <p className="font-medium truncate">{c.title}</p>
                <p className="text-xs text-gray-400">{c.messages?.length || 0} messages • {c.user_id?.slice(0, 8)}...</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</p>
                <button
                  onClick={() => setSelectedConvo(c)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded-lg flex items-center gap-1 transition"
                >
                  <Eye size={14} /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Viewer Modal */}
      {selectedConvo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="font-bold text-lg">{selectedConvo.title}</h3>
                <p className="text-xs text-gray-400">
                  {selectedConvo.messages?.length || 0} messages • User: {selectedConvo.user_id?.slice(0, 8)}... • {new Date(selectedConvo.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedConvo(null)} className="text-gray-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedConvo.messages?.length === 0 && (
                <p className="text-gray-500 text-center mt-8">No messages in this conversation.</p>
              )}
              {selectedConvo.messages?.map((msg, i) => (
                <div key={i} className={`p-3 rounded-2xl max-w-xl ${msg.role === "user" ? "bg-blue-600 self-end ml-auto text-white" : "bg-gray-700 text-gray-100"}`}>
                  {/* Severity badge */}
                  {msg.role === "assistant" && selectedConvo.severities?.[i] && (
                    <div className={`text-xs font-bold px-2 py-1 rounded-full inline-block mb-2 ${
                      selectedConvo.severities[i] === "HIGH" ? "bg-red-500 text-white" :
                      selectedConvo.severities[i] === "MEDIUM" ? "bg-yellow-500 text-black" :
                      "bg-green-500 text-black"
                    }`}>
                      {selectedConvo.severities[i] === "HIGH" ? "🔴 CRITICAL" : selectedConvo.severities[i] === "MEDIUM" ? "🟡 MEDIUM" : "🟢 LOW"}
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

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    green: "text-green-400 bg-green-500/10",
    red: "text-red-400 bg-red-500/10",
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