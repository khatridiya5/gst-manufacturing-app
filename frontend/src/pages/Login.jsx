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

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');

  .login-root {
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    background: #080c14;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    position: relative;
    overflow: hidden;
  }

  .login-root::before {
    content: '';
    position: fixed;
    top: -30%;
    left: -10%;
    width: 55%;
    height: 70%;
    background: radial-gradient(ellipse, rgba(20, 184, 166, 0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  .login-root::after {
    content: '';
    position: fixed;
    bottom: -20%;
    right: -10%;
    width: 50%;
    height: 60%;
    background: radial-gradient(ellipse, rgba(56, 189, 248, 0.06) 0%, transparent 70%);
    pointer-events: none;
  }

  .grid-bg {
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }

  .card-wrap {
    width: 100%;
    max-width: 420px;
    position: relative;
    z-index: 10;
  }

  .brand {
    text-align: center;
    margin-bottom: 2rem;
  }

  .brand-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: linear-gradient(135deg, #0d9488, #0891b2);
    margin-bottom: 1rem;
    box-shadow: 0 0 0 1px rgba(20,184,166,0.3), 0 8px 32px rgba(13,148,136,0.25);
  }

  .brand-name {
    font-family: 'Syne', sans-serif;
    font-size: 1.3rem;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .brand-sub {
    font-size: 0.8rem;
    color: #475569;
    margin: 0.3rem 0 0;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .card {
    background: rgba(15, 23, 38, 0.9);
    border: 1px solid rgba(148,163,184,0.08);
    border-radius: 20px;
    overflow: hidden;
    backdrop-filter: blur(20px);
    box-shadow: 0 24px 64px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid rgba(148,163,184,0.07);
    background: rgba(0,0,0,0.2);
  }

  .tab-btn {
    flex: 1;
    padding: 1rem;
    font-size: 0.8rem;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    color: #475569;
    margin-bottom: -1px;
  }

  .tab-btn.active {
    color: #2dd4bf;
    border-bottom-color: #2dd4bf;
    background: rgba(45,212,191,0.04);
  }

  .tab-btn:not(.active):hover {
    color: #94a3b8;
  }

  .form-body {
    padding: 1.75rem;
  }

  .field {
    margin-bottom: 1.1rem;
  }

  .field-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 0.5rem;
  }

  .input-wrap {
    position: relative;
  }

  .field-input {
    width: 100%;
    padding: 0.7rem 2.8rem 0.7rem 1rem;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(148,163,184,0.1);
    border-radius: 10px;
    color: #f1f5f9;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.875rem;
    outline: none;
    transition: all 0.2s;
    box-sizing: border-box;
    -webkit-appearance: none;
  }

  .field-input::placeholder {
    color: #334155;
  }

  .field-input:focus {
    border-color: rgba(45,212,191,0.4);
    background: rgba(30, 41, 59, 0.8);
    box-shadow: 0 0 0 3px rgba(45,212,191,0.08);
  }

  .field-input option {
    background: #0f172a;
    color: #f1f5f9;
  }

  .eye-btn {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #475569;
    padding: 0;
    display: flex;
    align-items: center;
    transition: color 0.2s;
    line-height: 0;
  }

  .eye-btn:hover {
    color: #94a3b8;
  }

  .error-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.18);
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    margin-bottom: 1rem;
  }

  .error-dot {
    width: 5px;
    height: 5px;
    background: #f87171;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .error-text {
    font-size: 0.78rem;
    color: #fca5a5;
    line-height: 1.4;
  }

  .submit-btn {
    width: 100%;
    padding: 0.8rem;
    background: linear-gradient(135deg, #0d9488, #0891b2);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-family: 'Syne', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(13,148,136,0.3);
    position: relative;
    overflow: hidden;
  }

  .submit-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
    pointer-events: none;
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(13,148,136,0.4);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-btn:disabled {
    background: rgba(13,148,136,0.25);
    color: rgba(255,255,255,0.3);
    box-shadow: none;
    cursor: not-allowed;
  }

  .footer-txt {
    text-align: center;
    font-size: 0.7rem;
    color: #1e293b;
    margin-top: 1.25rem;
    letter-spacing: 0.03em;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: rgba(148,163,184,0.08);
  }

  .divider-label {
    font-size: 0.7rem;
    color: #334155;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .section-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 1.1rem;
  }

  .section-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(148,163,184,0.1);
    background: rgba(30,41,59,0.4);
    cursor: pointer;
    transition: all 0.18s;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 500;
  }

  .section-option:hover {
    border-color: rgba(45,212,191,0.2);
    color: #94a3b8;
  }

  .section-option.selected {
    border-color: rgba(45,212,191,0.35);
    background: rgba(45,212,191,0.06);
    color: #2dd4bf;
  }

  .section-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }
`

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  )
}

function Field({ label, type = 'text', value, onChange, placeholder, required }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="field" style={{ marginBottom: '1.1rem' }}>
      <label className="field-label">{label}</label>
      <div className="input-wrap">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="field-input"
        />
        {isPassword && (
          <button type="button" className="eye-btn" onClick={() => setShow(s => !s)} tabIndex={-1}>
            <EyeIcon open={show} />
          </button>
        )}
      </div>
    </div>
  )
}

function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <div className="error-box">
      <div className="error-dot" />
      <p className="error-text">{msg}</p>
    </div>
  )
}

const SECTIONS = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'production', label: 'Production' },
  { value: 'sales', label: 'Sales' },
  { value: 'store', label: 'In-Store' },
]

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
      localStorage.setItem(`token_${section}`, res.data.access_token)
      localStorage.setItem(`role_${section}`, res.data.role)
      sessionStorage.setItem('active_section', section)   // ← only new line
      navigate(sectionRedirects[section] || '/')
    } catch (err) {
      setError(extractError(err, 'Invalid credentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <div style={{ marginBottom: '1.1rem' }}>
        <label className="field-label">Department</label>
        <div className="section-grid">
          {SECTIONS.map(s => (
            <button
              key={s.value}
              type="button"
              className={`section-option${section === s.value ? ' selected' : ''}`}
              onClick={() => setSection(s.value)}
            >
              <span className="section-dot" />
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Username" type="text" value={username} placeholder="Enter your username" required onChange={e => setUsername(e.target.value)} />
      <Field label="Password" type="password" value={password} placeholder="Enter your password" required onChange={e => setPassword(e.target.value)} />
      <ErrorMsg msg={error} />
      <button type="submit" disabled={loading} className="submit-btn">
        {loading ? 'Authenticating...' : 'Sign In'}
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

      // ✅ Store under namespaced keys + set active_section to 'admin'
      localStorage.setItem('token_admin', res.data.access_token)
      localStorage.setItem('role_admin', res.data.role)
      localStorage.setItem('token', res.data.access_token)   // backward compat
      localStorage.setItem('role', res.data.role)             // backward compat
      sessionStorage.setItem('active_section', 'admin')
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
      <Field label="Email Address" type="text" value={email} placeholder="admin@company.com" required onChange={e => setEmail(e.target.value)} />
      <Field label="Password" type="password" value={password} placeholder="Enter your password" required onChange={e => setPassword(e.target.value)} />
      <ErrorMsg msg={error} />
      <button type="submit" disabled={loading} className="submit-btn">
        {loading ? 'Authenticating...' : 'Sign In as Admin'}
      </button>
    </form>
  )
}

export default function Login() {
  const [tab, setTab] = useState('employee')
  const navigate = useNavigate()

  return (
    <>
      <style>{styles}</style>
      <div className="login-root">
        <div className="grid-bg" />
        <div className="card-wrap">
          <div className="brand">
            <div className="brand-logo">
              <LogoIcon />
            </div>
            <h1 className="brand-name">GST Manufacturing</h1>
            <p className="brand-sub">Production &amp; Inventory System</p>
          </div>

          <div className="card">
            <div className="tabs">
              {[['employee', 'Employee'], ['admin', 'Administrator']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`tab-btn${tab === key ? ' active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="form-body">
              {tab === 'employee'
                ? <EmployeeLoginForm navigate={navigate} />
                : <AdminLoginForm navigate={navigate} />
              }
            </div>
          </div>

          <p className="footer-txt">
            &copy; {new Date().getFullYear()} GST Manufacturing &middot; All rights reserved
          </p>
        </div>
      </div>
    </>
  )
}