import { useState, useEffect } from "react"
import { supabase } from "./supabase"
import { ArrowLeft, Wifi, Zap, Clock, Activity } from "lucide-react"

export default function SpeedTest({ onBack, darkMode, t }) {
  var [testing, setTesting] = useState(false)
  var [result, setResult] = useState(null)
  var [history, setHistory] = useState([])
  var [loading, setLoading] = useState(true)

  useEffect(() => { loadHistory() }, [])

  var loadHistory = async () => {
    setLoading(true)
    var session = (await supabase.auth.getSession()).data.session
    if (session) {
      var res = await supabase
        .from("speed_tests")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10)
      setHistory(res.data || [])
    }
    setLoading(false)
  }

  var runTest = async () => {
    setTesting(true)
    setResult(null)

    var pingResults = []
    for (var i = 0; i < 5; i++) {
      var start = performance.now()
      try {
        await fetch("/api/diagnose", { method: "OPTIONS" })
      } catch (e) {}
      var end = performance.now()
      pingResults.push(end - start)
    }

    var avgPing = Math.round(pingResults.reduce((a, b) => a + b, 0) / pingResults.length)
    var jitter = Math.round(Math.max.apply(null, pingResults) - Math.min.apply(null, pingResults))

    var downloadSpeed = 0
    try {
      var dlStart = performance.now()
      var response = await fetch("https://speed.cloudflare.com/__down?bytes=1000000")
      await response.blob()
      var dlEnd = performance.now()
      var dlTime = (dlEnd - dlStart) / 1000
      downloadSpeed = parseFloat(((1000000 * 8) / dlTime / 1000000).toFixed(2))
    } catch (e) {
      downloadSpeed = 0
    }

    var uploadSpeed = 0
    try {
      var blob = new Blob([new ArrayBuffer(100000)])
      var ulStart = performance.now()
      await fetch("https://speed.cloudflare.com/__up", {
        method: "POST",
        body: blob
      })
      var ulEnd = performance.now()
      var ulTime = (ulEnd - ulStart) / 1000
      uploadSpeed = parseFloat(((100000 * 8) / ulTime / 1000000).toFixed(2))
    } catch (e) {
      uploadSpeed = 0
    }

    var connectionType = "Unknown"
    if (navigator.connection) {
      connectionType = navigator.connection.effectiveType || "Unknown"
    }

    var testResult = {
      download_speed: downloadSpeed,
      upload_speed: uploadSpeed,
      ping: avgPing,
      jitter: jitter,
      connection_type: connectionType,
      provider: "Auto-detected"
    }

    setResult(testResult)

    var session = (await supabase.auth.getSession()).data.session
    if (session) {
      await supabase.from("speed_tests").insert({
        user_id: session.user.id,
        download_speed: downloadSpeed,
        upload_speed: uploadSpeed,
        ping: avgPing,
        jitter: jitter,
        connection_type: connectionType,
        provider: connectionType
      })
      loadHistory()
    }

    setTesting(false)
  }

  var bg = darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
  var cardBg = darkMode ? "bg-gray-800" : "bg-white border border-gray-200"

  return (
    <div className={"min-h-screen p-6 " + bg}>
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition">
        <ArrowLeft size={18} /> {t.signOut ? "Back" : "Back"}
      </button>

      <h1 className="text-3xl font-bold text-blue-400 mb-2">📡 {t.speedTest}</h1>
      <p className="text-gray-400 mb-6">{t.describeProblem}</p>

      <div className={"rounded-2xl p-6 mb-6 " + cardBg}>
        <button
          onClick={runTest}
          disabled={testing}
          className={"w-full py-4 rounded-xl font-bold text-lg transition " + (testing ? "bg-gray-600 text-gray-300" : "bg-blue-600 hover:bg-blue-500 text-white")}
        >
          {testing ? t.testing : t.runSpeedTest}
        </button>

        {testing && (
          <div className="flex justify-center mt-6">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {result && !testing && (
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className={"rounded-xl p-4 text-center " + (darkMode ? "bg-gray-700" : "bg-gray-100")}>
              <Wifi size={20} className="text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-400">{result.download_speed}</p>
              <p className="text-xs text-gray-400">Mbps {t.download}</p>
            </div>
            <div className={"rounded-xl p-4 text-center " + (darkMode ? "bg-gray-700" : "bg-gray-100")}>
              <Zap size={20} className="text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-400">{result.upload_speed}</p>
              <p className="text-xs text-gray-400">Mbps {t.upload}</p>
            </div>
            <div className={"rounded-xl p-4 text-center " + (darkMode ? "bg-gray-700" : "bg-gray-100")}>
              <Clock size={20} className="text-yellow-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-400">{result.ping}</p>
              <p className="text-xs text-gray-400">ms {t.ping}</p>
            </div>
            <div className={"rounded-xl p-4 text-center " + (darkMode ? "bg-gray-700" : "bg-gray-100")}>
              <Activity size={20} className="text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-400">{result.jitter}</p>
              <p className="text-xs text-gray-400">ms {t.jitter}</p>
            </div>
          </div>
        )}
      </div>

      <div className={"rounded-2xl p-6 " + cardBg}>
        <h2 className="text-xl font-bold mb-4">{t.speedHistory}</h2>
        {history.length === 0 && <p className="text-gray-400 text-center py-4">{t.noTests}</p>}
        <div className="space-y-2">
          {history.map(h => (
            <div key={h.id} className={"flex items-center justify-between p-3 rounded-xl " + (darkMode ? "bg-gray-700" : "bg-gray-100")}>
              <div>
                <p className="text-sm font-medium">
                  ↓ {h.download_speed} Mbps • ↑ {h.upload_speed} Mbps
                </p>
                <p className="text-xs text-gray-400">
                  {h.ping}ms ping • {h.jitter}ms jitter • {h.connection_type}
                </p>
              </div>
              <p className="text-xs text-gray-500">{new Date(h.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}