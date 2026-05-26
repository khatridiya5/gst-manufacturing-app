import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

const style = document.createElement('style')
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Space+Grotesk:wght@600;700&display=swap');
  @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .auth-card { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .auth-input:focus { outline: none; border-color: #14b8a6; box-shadow: 0 0 0 3px rgba(20,184,166,0.18); }
  .auth-btn:hover:not(:disabled) { background: #0d9488; }
  .auth-btn:active:not(:disabled) { transform: scale(0.98); }
`
if (!document.head.querySelector('[data-auth-style]')) {
  style.setAttribute('data-auth-style', '')
  document.head.appendChild(style)
}

export default function AuthPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #0f2744 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-120px', right: '-120px',
        width: '400px', height: '400px', borderRadius: '50%',
        border: '1px solid rgba(20,184,166,0.12)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '-60px', right: '-60px',
        width: '260px', height: '260px', borderRadius: '50%',
        border: '1px solid rgba(20,184,166,0.08)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', left: '-100px',
        width: '320px', height: '320px', borderRadius: '50%',
        border: '1px solid rgba(20,184,166,0.10)', pointerEvents: 'none',
      }} />

      <div className="auth-card" style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
            marginBottom: '1rem',
            boxShadow: '0 8px 24px rgba(20,184,166,0.3)',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M4 14h8M16 14h8M14 4v8M14 16v8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="14" cy="14" r="3" fill="#fff"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '22px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px',
            letterSpacing: '-0.5px',
          }}>GST Manufacturing</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Production & Inventory System</p>
        </div>

        <div style={{
          background: '#1e293b',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '2rem' }}>
            <LoginForm navigate={navigate} />
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#334155', marginTop: '1.5rem' }}>
          © {new Date().getFullYear()} GST Manufacturing. All rights reserved.
        </p>
      </div>
    </div>
  )
}

function LoginForm({ navigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
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
      setError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <FieldLabel>Email address</FieldLabel>
      <AuthInput
        type="text" value={email} placeholder="you@company.com" required
        onChange={e => setEmail(e.target.value)}
        icon={<EmailIcon />}
      />

      <FieldLabel style={{ marginTop: '1.25rem' }}>Password</FieldLabel>
      <AuthInput
        type={showPass ? 'text' : 'password'} value={password}
        placeholder="••••••••" required
        onChange={e => setPassword(e.target.value)}
        icon={<LockIcon />}
        suffix={
          <button type="button" onClick={() => setShowPass(s => !s)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#475569', padding: '0 2px', lineHeight: 1,
          }}>
            {showPass ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <AuthButton loading={loading} style={{ marginTop: '1.75rem' }}>
        {loading ? <Spinner /> : 'Sign In'}
      </AuthButton>
    </form>
  )
}

function FieldLabel({ children, style: s }) {
  return <label style={{
    display: 'block', fontSize: '13px', fontWeight: 500,
    color: '#94a3b8', marginBottom: '8px', ...s,
  }}>{children}</label>
}

function AuthInput({ type, value, placeholder, required, onChange, icon, suffix }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
        color: '#475569', pointerEvents: 'none',
      }}>{icon}</span>
      <input
        className="auth-input"
        type={type} value={value} placeholder={placeholder} required={required}
        onChange={onChange}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: suffix ? '11px 44px 11px 42px' : '11px 14px 11px 42px',
          background: '#0f172a', border: '1px solid #334155',
          borderRadius: '10px', color: '#f1f5f9', fontSize: '14px',
          fontFamily: "'DM Sans', sans-serif",
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      />
      {suffix && <span style={{
        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
      }}>{suffix}</span>}
    </div>
  )
}

function AuthButton({ children, loading, style: s }) {
  return (
    <button
      type="submit" disabled={loading}
      className="auth-btn"
      style={{
        width: '100%', padding: '12px',
        background: loading ? '#0f6e56' : '#14b8a6',
        color: '#fff', border: 'none', borderRadius: '10px',
        fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'background 0.2s, transform 0.1s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        ...s,
      }}
    >{children}</button>
  )
}

function ErrorBox({ children }) {
  return (
    <div style={{
      marginTop: '1rem', padding: '12px 16px',
      background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: '10px', color: '#f87171', fontSize: '13px',
    }}>{children}</div>
  )
}

function Spinner() {
  return <span style={{
    display: 'inline-block', width: '16px', height: '16px',
    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  }} />
}

const iconStyle = { width: 16, height: 16, display: 'block' }

function EmailIcon() {
  return <svg style={iconStyle} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="1" y="3" width="14" height="10" rx="2"/>
    <path d="M1 5l7 5 7-5"/>
  </svg>
}

function LockIcon() {
  return <svg style={iconStyle} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="7" width="10" height="8" rx="2"/>
    <path d="M5 7V5a3 3 0 016 0v2"/>
  </svg>
}

function EyeIcon() {
  return <svg style={iconStyle} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
    <circle cx="8" cy="8" r="2"/>
  </svg>
}

function EyeOffIcon() {
  return <svg style={iconStyle} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2 2l12 12M6.5 6.6A2 2 0 0010 10M4 4.5C2.5 5.8 1 8 1 8s2.5 5 7 5c1.3 0 2.4-.3 3.4-.8M7 3.1C7.3 3 7.6 3 8 3c4.5 0 7 5 7 5s-.7 1.3-2 2.6"/>
  </svg>
}