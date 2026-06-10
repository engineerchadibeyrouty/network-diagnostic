import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { Copy, Check, FileDown, Plus, MessageSquare, Trash2, LogOut, Shield, Menu, X, Ticket, MapPin, Wifi } from "lucide-react"
import jsPDF from "jspdf"
import { supabase } from "./supabase"
import translations from "./i18n"
import Auth from "./Auth"
import Admin from "./Admin"
import Tickets from "./Tickets"
import SpeedTest from "./SpeedTest"

var DAILY_LIMIT = 20

function App() {
  var [conversations, setConversations] = useState([])
  var [activeId, setActiveId] = useState(null)
  var [input, setInput] = useState("")
  var [loading, setLoading] = useState(false)
  var [copied, setCopied] = useState(null)
  var [darkMode, setDarkMode] = useState(true)
  var [dbLoading, setDbLoading] = useState(true)
  var [user, setUser] = useState(null)
  var [authLoading, setAuthLoading] = useState(true)
  var [isAdmin, setIsAdmin] = useState(false)
  var [showAdmin, setShowAdmin] = useState(false)
  var [showTickets, setShowTickets] = useState(false)
  var [showSpeedTest, setShowSpeedTest] = useState(false)
  var [sidebarOpen, setSidebarOpen] = useState(false)
  var [remaining, setRemaining] = useState(null)
  var [banned, setBanned] = useState(false)
  var [showNewTicket, setShowNewTicket] = useState(false)
  var [ticketTitle, setTicketTitle] = useState("")
  var [ticketMsg, setTicketMsg] = useState("")
  var [ticketLoading, setTicketLoading] = useState(false)
  var [ticketSuccess, setTicketSuccess] = useState(false)
  var [location, setLocation] = useState(null)
  var [locationAsked, setLocationAsked] = useState(false)
  var [lang, setLang] = useState("en")

  var t = translations[lang]
  var active = conversations.find(c => c.id === activeId)
  var isRTL = lang === "ar"

  useEffect(() => {
    supabase.auth.getSession().then(function(res) {
      var session = res.data.session
      setUser(session ? session.user : null)
      setAuthLoading(false)
      if (session && session.user) {
        checkBan(session.user.id)
        loadConversations(session.user.id)
        checkAdmin(session.user.id)
      } else setDbLoading(false)
    })

    var sub = supabase.auth.onAuthStateChange(function(_event, session) {
      setUser(session ? session.user : null)
      if (session && session.user) {
        checkBan(session.user.id)
        loadConversations(session.user.id)
        checkAdmin(session.user.id)
      } else { setConversations([]); setDbLoading(false); setIsAdmin(false) }
    })

    return function() { sub.data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (user && !locationAsked) {
      setLocationAsked(true)
      requestLocation()
    }
  }, [user])

  var getDeviceInfo = async function() {
    var ua = navigator.userAgent
    var device = "Unknown"
    var browser = "Unknown"
    var os = "Unknown"

    if (/iPhone/.test(ua)) device = "iPhone"
    else if (/iPad/.test(ua)) device = "iPad"
    else if (/SM-/.test(ua)) device = (ua.match(/SM-[A-Za-z0-9]+/) || ["Samsung"])[0]
    else if (/Pixel/.test(ua)) device = (ua.match(/Pixel[^;)]*/) || ["Pixel"])[0]
    else if (/HUAWEI/.test(ua)) device = (ua.match(/HUAWEI[^;)]*/) || ["Huawei"])[0]
    else if (/Xiaomi|Redmi|POCO/.test(ua)) device = (ua.match(/(Xiaomi|Redmi|POCO)[^;)]*/) || ["Xiaomi"])[0]
    else if (/Android/.test(ua)) {
      var m = ua.match(/;\s*([^;)]+)\s*Build/)
      device = m ? m[1].trim() : "Android Device"
    }
    else if (/Macintosh/.test(ua)) device = "Mac"
    else if (/Windows/.test(ua)) device = "Windows PC"
    else if (/Linux/.test(ua)) device = "Linux PC"

    if (/Edg\//.test(ua)) browser = "Edge"
    else if (/Chrome\//.test(ua)) browser = "Chrome"
    else if (/Firefox\//.test(ua)) browser = "Firefox"
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari"
    else if (/OPR\//.test(ua)) browser = "Opera"

    if (/Windows NT 10/.test(ua)) os = "Windows 10/11"
    else if (/Windows NT/.test(ua)) os = "Windows"
    else if (/Mac OS X/.test(ua)) os = "macOS"
    else if (/Android/.test(ua)) os = "Android " + ((ua.match(/Android\s*([\d.]+)/) || [])[1] || "")
    else if (/iPhone OS/.test(ua)) os = "iOS " + ((ua.match(/iPhone OS\s*([\d_]+)/) || [])[1] || "").replace(/_/g, ".")
    else if (/Linux/.test(ua)) os = "Linux"

    var screenSize = window.screen.width + "x" + window.screen.height
    var language = navigator.language || "Unknown"
    var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown"
    var connectionType = "Unknown"
    if (navigator.connection) {
      connectionType = navigator.connection.effectiveType || "Unknown"
      if (navigator.connection.type) connectionType = navigator.connection.type + " (" + navigator.connection.effectiveType + ")"
    }
    var batteryLevel = "Unknown"
    try {
      if (navigator.getBattery) {
        var bat = await navigator.getBattery()
        batteryLevel = Math.round(bat.level * 100) + "%" + (bat.charging ? " (charging)" : "")
      }
    } catch (e) { batteryLevel = "N/A" }

    var networkSpeed = "Unknown"
    try {
      var s = performance.now()
      await fetch("/api/diagnose", { method: "OPTIONS" })
      var en = performance.now()
      var p = Math.round(en - s)
      networkSpeed = p + "ms ping"
      if (navigator.connection && navigator.connection.downlink) {
        networkSpeed = navigator.connection.downlink + " Mbps / " + p + "ms ping"
      }
    } catch (e) { networkSpeed = "N/A" }

    var cpuCores = navigator.hardwareConcurrency || null
    var ramGb = navigator.deviceMemory || null
    var touchSupport = "ontouchstart" in window || navigator.maxTouchPoints > 0
    var colorDepth = window.screen.colorDepth || null
    var pixelRatio = window.devicePixelRatio || null
    var orientation = window.screen.orientation ? window.screen.orientation.type.replace("-primary", "").replace("-secondary", "") : (window.innerHeight > window.innerWidth ? "portrait" : "landscape")
    var platform = navigator.platform || "Unknown"

    return { device, browser, os, screenSize, language, timezone, connectionType, batteryLevel, networkSpeed, cpuCores, ramGb, touchSupport, colorDepth, pixelRatio, orientation, platform }
  }

  var requestLocation = function() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async function(pos) {
        var lat = pos.coords.latitude
        var lon = pos.coords.longitude
        var deviceInfo = await getDeviceInfo()
        try {
          var res = await fetch("https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json")
          var data = await res.json()
          setLocation(Object.assign({ latitude: lat, longitude: lon, city: data.address?.city || data.address?.town || data.address?.village || null, region: data.address?.state || data.address?.county || null }, deviceInfo))
        } catch (e) {
          setLocation(Object.assign({ latitude: lat, longitude: lon, city: null, region: null }, deviceInfo))
        }
      },
      function() {}
    )
  }

  var checkBan = async function(userId) {
    var res = await supabase.from("banned_users").select("user_id").eq("user_id", userId).single()
    if (res.data) { setBanned(true); await supabase.auth.signOut() }
  }

  var loadConversations = async function(userId) {
    setDbLoading(true)
    var res = await supabase.from("conversations").select("*").eq("user_id", userId).order("created_at", { ascending: false })
    if (!res.error && res.data.length > 0) { setConversations(res.data); setActiveId(res.data[0].id) }
    else { await addConversation(userId) }
    setDbLoading(false)
  }

  var checkAdmin = async function(userId) {
    var res = await supabase.from("admins").select("user_id").eq("user_id", userId).single()
    setIsAdmin(!!res.data)
  }

  var addConversation = async function(userId) {
    var uid = userId || (user ? user.id : null)
    var res = await supabase.from("conversations").insert({ title: "New Conversation", messages: [], severities: {}, user_id: uid }).select().single()
    if (!res.error) { setConversations(function(prev) { return [res.data].concat(prev) }); setActiveId(res.data.id) }
  }

  var deleteConversation = async function(id) {
    await supabase.from("conversations").delete().eq("id", id)
    setConversations(function(prev) {
      var rem = prev.filter(function(c) { return c.id !== id })
      if (rem.length === 0) { addConversation(); return [] }
      if (id === activeId) setActiveId(rem[0].id)
      return rem
    })
  }

  var updateConversation = async function(id, updates) {
    setConversations(function(prev) { return prev.map(function(c) { return c.id === id ? Object.assign({}, c, updates) : c }) })
    await supabase.from("conversations").update(updates).eq("id", id)
  }

  var sendMessage = async function(text) {
    var msg = text || input
    if (!msg.trim() || !active) return

    var userMsg = { role: "user", content: msg }
    var newMessages = active.messages.concat([userMsg])
    var newTitle = active.messages.length === 0 ? msg.slice(0, 40) : active.title

    await updateConversation(active.id, { messages: newMessages, title: newTitle })
    setInput("")
    setLoading(true)

    try {
      var session = (await supabase.auth.getSession()).data.session
      var headers = { "Content-Type": "application/json" }
      if (session) headers["Authorization"] = "Bearer " + session.access_token

      var response = await fetch("/api/diagnose", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ message: msg, history: active.messages, location: location || null })
      })

      if (response.status === 403) {
        var err = await response.json()
        await updateConversation(active.id, { messages: newMessages.concat([{ role: "assistant", content: "🚫 " + err.error }]) })
        setLoading(false)
        return
      }
      if (response.status === 429) {
        var err2 = await response.json()
        await updateConversation(active.id, { messages: newMessages.concat([{ role: "assistant", content: "⚠️ " + err2.error }]) })
        setRemaining(0)
        setLoading(false)
        return
      }

      var data = await response.json()
      var aiIndex = newMessages.length
      var newSeverities = Object.assign({}, active.severities)
      newSeverities[aiIndex] = data.severity
      var finalMessages = newMessages.concat([{ role: "assistant", content: data.reply }])
      await updateConversation(active.id, { messages: finalMessages, severities: newSeverities })
      if (data.remaining !== null && data.remaining !== undefined) setRemaining(data.remaining)
    } catch (err3) {
      await updateConversation(active.id, { messages: newMessages.concat([{ role: "assistant", content: "Error connecting to server." }]) })
    }
    setLoading(false)
  }

  var submitTicket = async function() {
    if (!ticketTitle.trim() || !ticketMsg.trim()) return
    setTicketLoading(true)
    var session = (await supabase.auth.getSession()).data.session
    await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
      body: JSON.stringify({ action: "create_ticket", title: ticketTitle, message: ticketMsg, conversationId: active ? active.id : null })
    })
    setTicketLoading(false)
    setTicketSuccess(true)
    setTicketTitle("")
    setTicketMsg("")
    setTimeout(function() { setShowNewTicket(false); setTicketSuccess(false) }, 2000)
  }

  var copyToClipboard = function(text, index) {
    navigator.clipboard.writeText(text)
    setCopied(index)
    setTimeout(function() { setCopied(null) }, 2000)
  }

  var exportPDF = function(content, severity, index) {
    var doc = new jsPDF()
    var pageWidth = doc.internal.pageSize.getWidth()
    var margin = 20
    var maxWidth = pageWidth - margin * 2
    var y = 20
    doc.setFillColor(30, 41, 59)
    doc.rect(0, 0, pageWidth, 40, "F")
    doc.setTextColor(96, 165, 250)
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("Network Diagnostic Report", margin, 25)
    y = 55
    var sev = severity || "MEDIUM"
    var severityColors = { HIGH: [239, 68, 68], MEDIUM: [234, 179, 8], LOW: [34, 197, 94] }
    var col = severityColors[sev]
    doc.setFillColor(col[0], col[1], col[2])
    doc.roundedRect(margin, y - 6, 35, 10, 2, 2, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.text(sev === "HIGH" ? "CRITICAL" : sev, margin + 4, y + 1)
    y += 15
    var clean = content.replace(/#{1,6}\s/g, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`(.*?)`/g, "$1")
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    var lines = doc.splitTextToSize(clean, maxWidth)
    lines.forEach(function(line) { if (y > 270) { doc.addPage(); y = 20 }; doc.text(line, margin, y); y += 7 })
    doc.save("diagnosis-report-" + (index + 1) + ".pdf")
  }

  var bg = darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
  var sidebarBg = darkMode ? "bg-gray-950 border-gray-800" : "bg-white border-gray-200"
  var chatBg = darkMode ? "bg-gray-800" : "bg-white border border-gray-200"
  var inputBg = darkMode ? "bg-gray-700 text-white placeholder-gray-400" : "bg-gray-200 text-gray-900 placeholder-gray-500"
  var sidebarItemClass = function(isActive) {
    return darkMode
      ? isActive ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"
      : isActive ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"
  }
  var promptBtn = darkMode
    ? "bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-blue-500 text-gray-300"
    : "bg-gray-100 hover:bg-gray-200 border-gray-300 hover:border-blue-400 text-gray-700"

  if (authLoading) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-gray-400 text-lg">{t.loading}</div>
    </div>
  )

  if (banned) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-5xl mb-4">🚫</p>
        <h1 className="text-2xl font-bold text-red-400 mb-2">{t.banned}</h1>
        <p className="text-gray-400">{t.bannedMsg}</p>
      </div>
    </div>
  )

  if (!user) return <Auth t={t} lang={lang} setLang={setLang} />
  if (showAdmin && isAdmin) return <Admin onBack={function() { setShowAdmin(false) }} />
  if (showTickets) return <Tickets onBack={function() { setShowTickets(false) }} darkMode={darkMode} />
  if (showSpeedTest) return <SpeedTest onBack={function() { setShowSpeedTest(false) }} darkMode={darkMode} t={t} />
  if (dbLoading) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-gray-400 text-lg">{t.loading}</div>
    </div>
  )

  return (
    <div className={"min-h-screen flex " + bg} dir={isRTL ? "rtl" : "ltr"}>

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={function() { setSidebarOpen(false) }} />}

      <div className={"fixed md:static z-30 h-full md:h-auto w-64 flex flex-col p-4 gap-2 border-r transition-transform duration-300 " + sidebarBg + " " + (sidebarOpen ? "translate-x-0" : (isRTL ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0"))}>
        <div className="flex items-center justify-between">
          <div className="text-blue-400 font-bold text-lg">🌐 {t.appName}</div>
          <button onClick={function() { setSidebarOpen(false) }} className="md:hidden text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 truncate">{user.email}</p>

        <div className="flex gap-1">
          {["en", "ar", "fr"].map(function(l) {
            return <button key={l} onClick={function() { setLang(l) }}
              className={"px-2 py-0.5 rounded-full text-xs transition " + (lang === l ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400")}>
              {l === "en" ? "EN" : l === "ar" ? "ع" : "FR"}
            </button>
          })}
        </div>

        {location && <div className="flex items-center gap-1 text-xs text-green-400"><MapPin size={10} /><span className="truncate">{location.city || t.locationDetected}</span></div>}
        {!location && <button onClick={requestLocation} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition"><MapPin size={10} /> {t.enableLocation}</button>}

        <button onClick={function() { setDarkMode(!darkMode) }} className="text-xs px-3 py-1 rounded-full border border-gray-700 hover:border-blue-400 text-gray-400 hover:text-white transition self-start">
          {darkMode ? "☀️ " + t.lightMode : "🌙 " + t.darkMode}
        </button>

        {isAdmin && <button onClick={function() { setShowAdmin(true) }} className="flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-yellow-700 hover:border-yellow-400 text-yellow-500 hover:text-yellow-300 transition self-start"><Shield size={12} /> {t.admin}</button>}

        <button onClick={function() { setShowTickets(true) }} className="flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-gray-700 hover:border-blue-400 text-gray-400 hover:text-white transition self-start"><Ticket size={12} /> {t.myTickets}</button>

        <button onClick={function() { setShowSpeedTest(true) }} className="flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-gray-700 hover:border-green-400 text-gray-400 hover:text-green-400 transition self-start"><Wifi size={12} /> {t.speedTest}</button>

        <button onClick={function() { supabase.auth.signOut() }} className="flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-gray-700 hover:border-red-400 text-gray-400 hover:text-red-400 transition self-start"><LogOut size={12} /> {t.signOut}</button>

        <button onClick={function() { addConversation(); setSidebarOpen(false) }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl text-sm font-semibold transition text-white mt-1"><Plus size={16} /> {t.newChat}</button>

        <div className="flex flex-col gap-1 mt-2 overflow-y-auto flex-1">
          {conversations.map(function(c) {
            return <div key={c.id} onClick={function() { setActiveId(c.id); setSidebarOpen(false) }}
              className={"flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-sm group transition " + sidebarItemClass(c.id === activeId)}>
              <div className="flex items-center gap-2 truncate"><MessageSquare size={14} /><span className="truncate">{c.title}</span></div>
              <button onClick={function(e) { e.stopPropagation(); deleteConversation(c.id) }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition"><Trash2 size={14} /></button>
            </div>
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center py-6 px-4 min-w-0">
        <div className="w-full flex items-center justify-between mb-4 md:hidden">
          <button onClick={function() { setSidebarOpen(true) }} className="text-gray-400 hover:text-white"><Menu size={24} /></button>
          <div className="text-blue-400 font-bold">🌐 {t.appName}</div>
          <div className="w-6" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-4xl font-bold text-blue-400 mb-2">{t.networkAssistant}</h1>
          <p className={darkMode ? "text-gray-400" : "text-gray-500"}>{t.describeProblem}</p>
          {location && <p className="text-xs text-green-400 mt-1 flex items-center justify-center gap-1"><MapPin size={10} />{location.city ? location.city + ", Lebanon" : "Lebanon"} — {t.locationAware}</p>}
        </div>

        {active && active.messages.length === 0 && (
          <div className="w-full max-w-3xl mb-6">
            <p className={"text-sm mb-3 text-center " + (darkMode ? "text-gray-500" : "text-gray-400")}>{t.commonProblems}</p>
            <div className="grid grid-cols-2 gap-2">
              {t.prompts.map(function(prompt, i) {
                return <button key={i} onClick={function() { sendMessage(prompt) }} className={"border text-sm px-4 py-3 rounded-xl text-left transition " + promptBtn}>{prompt}</button>
              })}
            </div>
          </div>
        )}

        <div className={"w-full max-w-3xl rounded-2xl p-4 md:p-6 flex flex-col gap-4 min-h-96 mb-4 " + chatBg}>
          {active && active.messages.length === 0 && (
            <div className="text-center mt-16">
              <p className={darkMode ? "text-gray-500 text-lg" : "text-gray-400 text-lg"}>{t.noMessages}</p>
              <p className={darkMode ? "text-gray-600 text-sm mt-1" : "text-gray-400 text-sm mt-1"}>{t.clickPrompt}</p>
            </div>
          )}
          {active && active.messages.map(function(msg, i) {
            return <div key={i} className={"p-4 rounded-2xl max-w-2xl " + (msg.role === "user" ? "bg-blue-600 self-end text-white" : darkMode ? "bg-gray-700 self-start text-gray-100" : "bg-gray-100 self-start text-gray-800 border border-gray-200")}>
              {msg.role === "assistant" && (
                <div className="flex items-center justify-between mb-2">
                  {active.severities[i] ? <div className={"text-xs font-bold px-2 py-1 rounded-full inline-block " + (active.severities[i] === "HIGH" ? "bg-red-500 text-white" : active.severities[i] === "MEDIUM" ? "bg-yellow-500 text-black" : "bg-green-500 text-black")}>{active.severities[i] === "HIGH" ? "🔴 CRITICAL" : active.severities[i] === "MEDIUM" ? "🟡 MEDIUM" : "🟢 LOW"}</div> : <div />}
                  <div className="flex gap-2">
                    <button onClick={function() { exportPDF(msg.content, active.severities[i], i) }} className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-600"><FileDown size={16} /></button>
                    <button onClick={function() { copyToClipboard(msg.content, i) }} className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-600">{copied === i ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}</button>
                  </div>
                </div>
              )}
              {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
            </div>
          })}
          {loading && (
            <div className={"self-start p-4 rounded-2xl flex items-center gap-2 " + (darkMode ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500")}>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200" />
            </div>
          )}
        </div>

        {active && active.messages.length > 0 && (
          <div className="w-full max-w-3xl flex justify-end mb-2">
            <button onClick={function() { setTicketTitle(active.title || "Support request"); setShowNewTicket(true) }} className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-gray-700 hover:border-blue-400 text-gray-400 hover:text-white transition"><Ticket size={12} /> {t.openTicket}</button>
          </div>
        )}

        <div className="w-full max-w-3xl flex gap-2">
          <input className={"flex-1 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 " + inputBg} placeholder={t.placeholder} value={input} onChange={function(e) { setInput(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") sendMessage() }} dir={isRTL ? "rtl" : "ltr"} />
          <button onClick={function() { sendMessage() }} disabled={loading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold transition text-white">{t.sendBtn}</button>
        </div>

        {remaining !== null && (
          <div className="w-full max-w-3xl mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{t.dailyUsed}</span>
              <span className={remaining <= 3 ? "text-red-400" : "text-gray-500"}>{DAILY_LIMIT - remaining}/{DAILY_LIMIT}</span>
            </div>
            <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div className={"h-full rounded-full transition-all " + (remaining <= 3 ? "bg-red-500" : remaining <= 8 ? "bg-yellow-500" : "bg-blue-500")} style={{ width: (((DAILY_LIMIT - remaining) / DAILY_LIMIT) * 100) + "%" }} />
            </div>
          </div>
        )}
      </div>

      {showNewTicket && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">🎫 {t.ticketTitle}</h3>
              <button onClick={function() { setShowNewTicket(false) }} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            {ticketSuccess ? (
              <div className="text-center py-8"><p className="text-4xl mb-3">✅</p><p className="text-green-400 font-semibold">{t.ticketSuccess}</p></div>
            ) : (
              <div className="flex flex-col gap-3">
                <input className="bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400" placeholder={t.ticketPlaceholder} value={ticketTitle} onChange={function(e) { setTicketTitle(e.target.value) }} />
                <textarea className="bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 resize-none h-32" placeholder={t.ticketDesc} value={ticketMsg} onChange={function(e) { setTicketMsg(e.target.value) }} />
                <button onClick={submitTicket} disabled={ticketLoading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition text-white">{ticketLoading ? t.submitting : t.submitTicket}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App