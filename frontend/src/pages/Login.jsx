import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

function extractError(err, fallback) {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail[0]?.msg || fallback
  return fallback
}

export default function Login() {
  const [tab, setTab] = useState('employee')
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
            {[['employee','Employee Login'],['admin','Admin']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === key ? 'text-teal-400 border-teal-400' : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <div className="p-6">
            {tab === 'employee' ? <EmployeeLoginForm navigate={navigate} /> : <AdminLoginForm navigate={navigate} />}
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
        <input {...props} className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 transition-all" />
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

function EmployeeLoginForm({ navigate }) {
  const [section, setSection] = useState('purchase')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const sectionRedirects = {
    purchase: '/purchase',
    production: '/production',
    sales: '/sales',
    store: '/in-store',
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/section-login', { section, username, password })
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('role', res.data.role)
      navigate(sectionRedirects[section] || '/')
    } catch (err) {
      setError(extractError(err, 'Invalid credentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide">Section</label>
        <select value={section} onChange={e => setSection(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500">
          <option value="purchase">Purchase</option>
          <option value="production">Production</option>
          <option value="sales">Sales</option>
          <option value="store">In-Store</option>
        </select>
      </div>
      <Field label="Username" icon="👤" type="text" value={username} placeholder="Enter username" required onChange={e => setUsername(e.target.value)} />
      <Field label="Password" icon="🔒" type="password" value={password} placeholder="••••••••" required onChange={e => setPassword(e.target.value)} />
      <ErrorMsg msg={error} />
      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-900 disabled:text-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}

function AdminLoginForm({ navigate }) {
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
      if (res.data.role === 'admin') {
        try {
          const setupRes = await api.get('/auth/setup/status', {
            headers: { Authorization: `Bearer ${res.data.access_token}` }
          })
          if (!setupRes.data.setup_complete) { navigate('/setup'); return }
        } catch {}
      }
      navigate('/')
    } catch (err) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      setError(extractError(err, 'Invalid credentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <Field label="Email address" icon="✉" type="text" value={email} placeholder="admin@company.com" required onChange={e => setEmail(e.target.value)} />
      <Field label="Password" icon="🔒" type="password" value={password} placeholder="••••••••" required onChange={e => setPassword(e.target.value)} />
      <ErrorMsg msg={error} />
      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-900 disabled:text-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
        {loading ? 'Signing in...' : 'Sign in as Admin'}
      </button>
    </form>
  )
}
