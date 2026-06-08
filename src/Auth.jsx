import { useState } from "react"
import { supabase } from "./supabase"

export default function Auth() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage("Check your email to confirm your account!")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-blue-400 mb-2 text-center">🌐 NetDiag</h1>
        <p className="text-gray-400 text-center mb-8">AI-Powered Network Diagnostic Assistant</p>

        <h2 className="text-xl font-semibold mb-6">{isLogin ? "Sign In" : "Create Account"}</h2>

        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            className="bg-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-green-400 text-sm">{message}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition"
          >
            {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
          </button>

          <button
            onClick={() => { setIsLogin(prev => !prev); setError(""); setMessage("") }}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  )
}