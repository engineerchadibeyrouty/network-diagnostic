import { useState } from "react"
import { supabase } from "./supabase"

export default function Auth({ t, lang, setLang }) {
  var [email, setEmail] = useState("")
  var [password, setPassword] = useState("")
  var [isLogin, setIsLogin] = useState(true)
  var [loading, setLoading] = useState(false)
  var [error, setError] = useState("")
  var [message, setMessage] = useState("")

  var handleSubmit = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    if (isLogin) {
      var res = await supabase.auth.signInWithPassword({ email, password })
      if (res.error) setError(res.error.message)
    } else {
      var res2 = await supabase.auth.signUp({ email, password })
      if (res2.error) setError(res2.error.message)
      else setMessage(t.checkEmail)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-blue-400 mb-2 text-center">🌐 {t.appName}</h1>
        <p className="text-gray-400 text-center mb-6">{t.subtitle}</p>

        <div className="flex justify-center gap-2 mb-6">
          {["en", "ar", "fr"].map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={"px-3 py-1 rounded-full text-xs font-semibold transition " + (lang === l ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600")}>
              {l === "en" ? "English" : l === "ar" ? "العربية" : "Français"}
            </button>
          ))}
        </div>

        <h2 className="text-xl font-semibold mb-6">{isLogin ? t.signIn : t.signUp}</h2>

        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder={t.email}
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            dir={lang === "ar" ? "rtl" : "ltr"}
          />
          <input
            type="password"
            placeholder={t.password}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            className="bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            dir={lang === "ar" ? "rtl" : "ltr"}
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-green-400 text-sm">{message}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition"
          >
            {loading ? t.loading : isLogin ? t.signIn : t.signUp}
          </button>

          <button
            onClick={() => { setIsLogin(!isLogin); setError(""); setMessage("") }}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            {isLogin ? t.noAccount : t.hasAccount}
          </button>
        </div>
      </div>
    </div>
  )
}