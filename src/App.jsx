import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { Copy, Check, FileDown, Plus, MessageSquare, Trash2, LogOut, Shield, Menu, X } from "lucide-react"
import jsPDF from "jspdf"
import { supabase } from "./supabase"
import Auth from "./Auth"
import Admin from "./Admin"

const DAILY_LIMIT = 20

const QUICK_PROMPTS = [
  "My internet keeps dropping every 30 minutes",
  "My WiFi speed is very slow but signal is strong",
  "I can access some websites but not others",
  "My router shows connected but no internet access",
  "High ping and packet loss during video calls",
  "Fiber ONT light is red/orange",
]

function App() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(null)
  const [darkMode, setDarkMode] = useState(true)
  const [dbLoading, setDbLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [remaining, setRemaining] = useState(null)
  const [banned, setBanned] = useState(false)

  const active = conversations.find(c => c.id === activeId)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
      if (session?.user) {
        checkBan(session.user.id)
        loadConversations(session.user.id)
        checkAdmin(session.user.id)
      } else setDbLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        checkBan(session.user.id)
        loadConversations(session.user.id)
        checkAdmin(session.user.id)
      } else { setConversations([]); setDbLoading(false); setIsAdmin(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkBan = async (userId) => {
    const { data } = await supabase.from("banned_users").select("user_id").eq("user_id", userId).single()
    if (data) {
      setBanned(true)
      await supabase.auth.signOut()
    }
  }

  const loadConversations = async (userId) => {
    setDbLoading(true)
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (!error && data.length > 0) {
      setConversations(data)
      setActiveId(data[0].id)
    } else {
      await addConversation(userId)
    }
    setDbLoading(false)
  }

  const checkAdmin = async (userId) => {
    const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).single()
    setIsAdmin(!!data)
  }

  const addConversation = async (userId) => {
    const uid = userId || user?.id
    const { data, error } = await supabase
      .from("conversations")
      .insert({ title: "New Conversation", messages: [], severities: {}, user_id: uid })
      .select()
      .single()

    if (!error) {
      setConversations(prev => [data, ...prev])
      setActiveId(data.id)
    }
  }

  const deleteConversation = async (id) => {
    await supabase.from("conversations").delete().eq("id", id)
    setConversations(prev => {
      const remaining = prev.filter(c => c.id !== id)
      if (remaining.length === 0) { addConversation(); return [] }
      if (id === activeId) setActiveId(remaining[0].id)
      return remaining
    })
  }

  const updateConversation = async (id, updates) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    await supabase.from("conversations").update(updates).eq("id", id)
  }

  const sendMessage = async (text) => {
    const msg = text || input
    if (!msg.trim() || !active) return

    const userMsg = { role: "user", content: msg }
    const newMessages = [...active.messages, userMsg]
    const newTitle = active.messages.length === 0 ? msg.slice(0, 40) : active.title

    await updateConversation(active.id, { messages: newMessages, title: newTitle })
    setInput("")
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ message: msg, history: active.messages })
      })

      if (response.status === 403) {
        const err = await response.json()
        await updateConversation(active.id, {
          messages: [...newMessages, { role: "assistant", content: `🚫 ${err.error}` }]
        })
        setLoading(false)
        return
      }

      if (response.status === 429) {
        const err = await response.json()
        await updateConversation(active.id, {
          messages: [...newMessages, { role: "assistant", content: `⚠️ ${err.error}` }]
        })
        setRemaining(0)
        setLoading(false)
        return
      }

      const data = await response.json()
      const aiIndex = newMessages.length
      const newSeverities = { ...active.severities, [aiIndex]: data.severity }
      const finalMessages = [...newMessages, { role: "assistant", content: data.reply }]
      await updateConversation(active.id, { messages: finalMessages, severities: newSeverities })

      if (data.remaining !== null && data.remaining !== undefined) {
        setRemaining(data.remaining)
      }
    } catch (err) {
      await updateConversation(active.id, {
        messages: [...newMessages, { role: "assistant", content: "Error connecting to server." }]
      })
    }

    setLoading(false)
  }

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text)
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }

  const exportPDF = (content, severity, index) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - margin * 2
    let y = 20

    doc.setFillColor(30, 41, 59)
    doc.rect(0, 0, pageWidth, 40, "F")
    doc.setTextColor(96, 165, 250)
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("Network Diagnostic Report", margin, 25)
    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)
    doc.text(new Date().toLocaleString(), pageWidth - margin, 25, { align: "right" })
    y = 55

    const severityColors = { HIGH: [239, 68, 68], MEDIUM: [234, 179, 8], LOW: [34, 197, 94] }
    const sev = severity || "MEDIUM"
    const [r, g, b] = severityColors[sev]
    doc.setFillColor(r, g, b)
    doc.roundedRect(margin, y - 6, 35, 10, 2, 2, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text(sev === "HIGH" ? "CRITICAL" : sev, margin + 4, y + 1)
    y += 15

    const clean = content
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/\|.*\|/g, "")
      .replace(/[-]{3,}/g, "")

    doc.setTextColor(30, 30, 30)
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    const lines = doc.splitTextToSize(clean, maxWidth)
    lines.forEach(line => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(line, margin, y)
      y += 7
    })

    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text("Generated by Network Diagnostic Assistant", margin, 290)
    doc.save(`diagnosis-report-${index + 1}.pdf`)
  }

  const bg = darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
  const sidebarBg = darkMode ? "bg-gray-950 border-gray-800" : "bg-white border-gray-200"
  const chatBg = darkMode ? "bg-gray-800" : "bg-white border border-gray-200"
  const inputBg = darkMode ? "bg-gray-700 text-white placeholder-gray-400" : "bg-gray-200 text-gray-900 placeholder-gray-500"
  const sidebarItem = (isActive) => darkMode
    ? isActive ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"
    : isActive ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"
  const promptBtn = darkMode
    ? "bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-blue-500 text-gray-300"
    : "bg-gray-100 hover:bg-gray-200 border-gray-300 hover:border-blue-400 text-gray-700"

  if (authLoading) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-gray-400 text-lg">Loading...</div>
    </div>
  )

  if (banned) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-5xl mb-4">🚫</p>
        <h1 className="text-2xl font-bold text-red-400 mb-2">Account Banned</h1>
        <p className="text-gray-400">Your account has been suspended. Contact support for help.</p>
      </div>
    </div>
  )

  if (!user) return <Auth />
  if (showAdmin && isAdmin) return <Admin onBack={() => setShowAdmin(false)} />
  if (dbLoading) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-gray-400 text-lg">Loading your conversations...</div>
    </div>
  )

  return (
    <div className={`min-h-screen flex ${bg}`}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static z-30 h-full md:h-auto
        w-64 flex flex-col p-4 gap-2 border-r ${sidebarBg}
        transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="flex items-center justify-between">
          <div className="text-blue-400 font-bold text-lg">🌐 NetDiag</div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 truncate">{user.email}</p>
        <button
          onClick={() => setDarkMode(prev => !prev)}
          className="text-xs px-3 py-1 rounded-full border border-gray-700 hover:border-blue-400 text-gray-400 hover:text-white transition self-start"
        >
          {darkMode ? "☀️ Light mode" : "🌙 Dark mode"}
        </button>
        {isAdmin && (
          <button
            onClick={() => setShowAdmin(true)}
            className="flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-yellow-700 hover:border-yellow-400 text-yellow-500 hover:text-yellow-300 transition self-start"
          >
            <Shield size={12} /> Admin
          </button>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-gray-700 hover:border-red-400 text-gray-400 hover:text-red-400 transition self-start"
        >
          <LogOut size={12} /> Sign out
        </button>
        <button
          onClick={() => { addConversation(); setSidebarOpen(false) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl text-sm font-semibold transition text-white mt-1"
        >
          <Plus size={16} /> New Chat
        </button>
        <div className="flex flex-col gap-1 mt-2 overflow-y-auto flex-1">
          {conversations.map(c => (
            <div
              key={c.id}
              onClick={() => { setActiveId(c.id); setSidebarOpen(false) }}
              className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm group transition ${sidebarItem(c.id === activeId)}`}
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare size={14} />
                <span className="truncate">{c.title}</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); deleteConversation(c.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center py-6 px-4 min-w-0">

        {/* Mobile top bar */}
        <div className="w-full flex items-center justify-between mb-4 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
            <Menu size={24} />
          </button>
          <div className="text-blue-400 font-bold">🌐 NetDiag</div>
          <div className="w-6" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-4xl font-bold text-blue-400 mb-2">Network Diagnostic Assistant</h1>
          <p className={darkMode ? "text-gray-400" : "text-gray-500"}>Describe your network problem in plain English</p>
        </div>

        {active && active.messages.length === 0 && (
          <div className="w-full max-w-3xl mb-6">
            <p className={`text-sm mb-3 text-center ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Common problems — click to start:</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button key={i} onClick={() => sendMessage(prompt)}
                  className={`border text-sm px-4 py-3 rounded-xl text-left transition ${promptBtn}`}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`w-full max-w-3xl rounded-2xl p-4 md:p-6 flex flex-col gap-4 min-h-96 mb-4 ${chatBg}`}>
          {active && active.messages.length === 0 && (
            <div className="text-center mt-16">
              <p className={darkMode ? "text-gray-500 text-lg" : "text-gray-400 text-lg"}>No messages yet.</p>
              <p className={darkMode ? "text-gray-600 text-sm mt-1" : "text-gray-400 text-sm mt-1"}>Click a prompt above or type your problem below.</p>
            </div>
          )}
          {active && active.messages.map((msg, i) => (
            <div key={i} className={`p-4 rounded-2xl max-w-2xl ${msg.role === "user"
              ? "bg-blue-600 self-end text-white"
              : darkMode ? "bg-gray-700 self-start text-gray-100" : "bg-gray-100 self-start text-gray-800 border border-gray-200"
            }`}>
              {msg.role === "assistant" && (
                <div className="flex items-center justify-between mb-2">
                  {active.severities[i] ? (
                    <div className={`text-xs font-bold px-2 py-1 rounded-full inline-block ${
                      active.severities[i] === "HIGH" ? "bg-red-500 text-white" :
                      active.severities[i] === "MEDIUM" ? "bg-yellow-500 text-black" :
                      "bg-green-500 text-black"
                    }`}>
                      {active.severities[i] === "HIGH" ? "🔴 CRITICAL" : active.severities[i] === "MEDIUM" ? "🟡 MEDIUM" : "🟢 LOW"}
                    </div>
                  ) : <div />}
                  <div className="flex gap-2">
                    <button onClick={() => exportPDF(msg.content, active.severities[i], i)} className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-600" title="Export PDF">
                      <FileDown size={16} />
                    </button>
                    <button onClick={() => copyToClipboard(msg.content, i)} className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-600" title="Copy">
                      {copied === i ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                    </button>
                  </div>
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
                  table: ({node, ...props}) => <table className="w-full text-sm border-collapse my-2" {...props} />,
                  th: ({node, ...props}) => <th className="border border-gray-600 px-3 py-1 bg-gray-800 text-blue-300" {...props} />,
                  td: ({node, ...props}) => <td className="border border-gray-600 px-3 py-1" {...props} />,
                }}>
                  {msg.content}
                </ReactMarkdown>
              ) : msg.content}
            </div>
          ))}
          {loading && (
            <div className={`self-start p-4 rounded-2xl flex items-center gap-2 ${darkMode ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200" />
            </div>
          )}
        </div>

        <div className="w-full max-w-3xl flex gap-2">
          <input
            className={`flex-1 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            placeholder="e.g. My internet drops every 30 minutes..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold transition text-white"
          >
            Send
          </button>
        </div>

        {/* Daily limit indicator */}
        {remaining !== null && (
          <div className="w-full max-w-3xl mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Daily messages used</span>
              <span className={remaining <= 3 ? "text-red-400" : "text-gray-500"}>
                {DAILY_LIMIT - remaining}/{DAILY_LIMIT}
              </span>
            </div>
            <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  remaining <= 3 ? "bg-red-500" : remaining <= 8 ? "bg-yellow-500" : "bg-blue-500"
                }`}
                style={{ width: `${((DAILY_LIMIT - remaining) / DAILY_LIMIT) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App