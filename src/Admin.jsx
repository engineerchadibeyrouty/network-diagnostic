import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import { ArrowLeft, Users, MessageSquare, AlertTriangle, TrendingUp } from "lucide-react"

export default function Admin({ onBack }) {
  const [stats, setStats] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

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
    setConversations(convs?.slice(0, 20) || [])
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

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Recent Conversations</h2>
        <div className="space-y-2">
          {conversations.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-xl">
              <div className="flex-1 truncate">
                <p className="font-medium truncate">{c.title}</p>
                <p className="text-xs text-gray-400">{c.messages?.length || 0} messages</p>
              </div>
              <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
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