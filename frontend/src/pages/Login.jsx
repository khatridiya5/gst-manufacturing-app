import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

function passwordStrength(p) {
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return s
}

function extractError(err, fallback) {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail[0]?.msg || fallback
  return fallback
}

export default function Login() {
  const [tab, setTab] = useState('login')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-teal-600 mb-3 p-3">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">GST Manufacturing</h1>
          <p className="text-sm text-slate-500 mt-1">Production & inventory system</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex border-b border-slate-800">
            {[['login','Sign in'],['signup','Create account']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === key
                    ? 'text-teal-400 border-teal-400'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 'login'
              ? <LoginForm navigate={navigate} onSignup={() => setTab('signup')} />
              : <SignupForm navigate={navigate} onLogin={() => setTab('login')} />
            }
          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-5">
          © {new Date().getFullYear()} GST Manufacturing · All rights reserved
        </p>
      </div>
    </div>
  )
}

function Field({ label, icon, ...props }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{icon}</span>
        <input
          {...props}
          className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 transition-all"
        />
      </div>
    </div>
  )
}

function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-4">
      <span className="text-red-400 text-xs">✕</span>
      <p className="text-red-400 text-xs">{msg}</p>
    </div>
  )
}

function SuccessMsg({ msg }) {
  if (!msg) return null
  return (
    <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2.5 mb-4">
      <span className="text-teal-400 text-xs">✓</span>
      <p className="text-teal-400 text-xs">{msg}</p>
    </div>
  )
}

function LoginForm({ navigate, onSignup }) {
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

      // admin → check setup, staff → go straight to dashboard
      if (res.data.role === 'admin') {
        try {
          const setupRes = await api.get('/auth/setup/status', {
            headers: { Authorization: `Bearer ${res.data.access_token}` }
          })
          if (!setupRes.data.setup_complete) {
            navigate('/setup')
            return
          }
        } catch {
          // setup check failed, don't block — go to dashboard
        }
      }

      navigate('/')
    } catch (err) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      setError(extractError(err, 'Invalid email or password. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <Field label="Email address" icon="✉" type="text" value={email} placeholder="you@company.com" required onChange={e => setEmail(e.target.value)} />
      <Field label="Password" icon="🔒" type="password" value={password} placeholder="••••••••" required onChange={e => setPassword(e.target.value)} />
      <div className="flex justify-end -mt-2 mb-4">
        <span className="text-xs text-teal-500 cursor-pointer hover:text-teal-400">Forgot password?</span>
      </div>
      <ErrorMsg msg={error} />
      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-900 disabled:text-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-800" />
        <span className="text-xs text-slate-600">or</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>
      <p className="text-center text-sm text-slate-500">
        No account? <button type="button" onClick={onSignup} className="text-teal-400 hover:text-teal-300 font-medium">Create one</button>
      </p>
    </form>
  )
}

// ── SignupForm: after register → auto login → go to /setup ───
function SignupForm({ navigate, onLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = passwordStrength(password)
  const strengthColors = ['bg-red-500','bg-orange-400','bg-teal-400','bg-teal-500']
  const strengthLabels = ['Weak','Fair','Good','Strong']

  const handleSignup = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    try {
      // Step 1 — register
      await api.post('/auth/register', { name, email, password })

      // Step 2 — auto login with same credentials
      const form = new FormData()
      form.append('username', email)
      form.append('password', password)
      const res = await api.post('/auth/login', form)

      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('role', res.data.role)

      setSuccess('Account created! Setting up your workspace...')

      // Step 3 — go to /setup after short delay
      setTimeout(() => navigate('/setup'), 1200)

    } catch (err) {
      setError(extractError(err, 'Registration failed. Email may already exist.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSignup}>
      <Field label="Full name" icon="👤" type="text" value={name} placeholder="Your full name" required onChange={e => setName(e.target.value)} />
      <Field label="Work email" icon="✉" type="text" value={email} placeholder="you@company.com" required onChange={e => setEmail(e.target.value)} />
      <Field label="Password" icon="🔒" type="password" value={password} placeholder="Min. 8 characters" required onChange={e => setPassword(e.target.value)} />

      {password && (
        <div className="-mt-2 mb-4">
          <div className="flex gap-1 mb-1">
            {[0,1,2,3].map(i => (
              <div key={i} className={`h-0.5 flex-1 rounded-full transition-all ${i < strength ? strengthColors[strength-1] : 'bg-slate-700'}`} />
            ))}
          </div>
          <span className={`text-xs ${strength > 0 ? strengthColors[strength-1].replace('bg-','text-') : 'text-slate-500'}`}>
            {strengthLabels[strength-1]}
          </span>
        </div>
      )}

      <Field label="Confirm password" icon="🔒" type="password" value={confirm} placeholder="Re-enter password" required onChange={e => setConfirm(e.target.value)} />
      <ErrorMsg msg={error} />
      <SuccessMsg msg={success} />
      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-900 disabled:text-teal-700 text-white text-sm font-medium rounded-lg transition-colors mt-1">
        {loading ? 'Creating account...' : 'Create account'}
      </button>
      <p className="text-center text-sm text-slate-500 mt-5">
        Already have an account? <button type="button" onClick={onLogin} className="text-teal-400 hover:text-teal-300 font-medium">Sign in</button>
      </p>
    </form>
  )
}