import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function Login() {
  const [tab, setTab] = useState('login')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">G</span>
          </div>
          <h1 className="text-2xl font-bold text-white">GST Manufacturing</h1>
          <p className="text-slate-400 mt-1">Production & Inventory System</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'text-teal-400 border-b-2 border-teal-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                tab === 'signup'
                  ? 'text-teal-400 border-b-2 border-teal-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="p-8">
            {tab === 'login'
              ? <LoginForm navigate={navigate} />
              : <SignupForm onSuccess={() => setTab('login')} />
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ── LOGIN ────────────────────────────────────────────────────
function LoginForm({ navigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('username', email)
      form.append('password', password)
      const res = await api.post('/auth/login', form)
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('role', res.data.role)
      navigate('/')
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
        <input
          type="email" value={email} placeholder="you@company.com" required
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
        <input
          type="password" value={password} placeholder="••••••••" required
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      <button
        type="submit" disabled={loading}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white font-semibold rounded-lg transition-colors"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}

// ── SIGNUP ───────────────────────────────────────────────────
function SignupForm({ onSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', { name, email, password })
      setSuccess('Account created! Redirecting to sign in...')
      setTimeout(onSuccess, 2000)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Registration failed. Email may already exist.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSignup} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
        <input
          type="text" value={name} placeholder="Your name" required
          onChange={e => setName(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Work Email</label>
        <input
          type="email" value={email} placeholder="you@company.com" required
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
        <input
          type="password" value={password} placeholder="Min. 8 characters" required
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
        <input
          type="password" value={confirm} placeholder="Re-enter password" required
          onChange={e => setConfirm(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-4 py-3">
          <p className="text-teal-400 text-sm">{success}</p>
        </div>
      )}
      <button
        type="submit" disabled={loading}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white font-semibold rounded-lg transition-colors"
      >
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  )
}