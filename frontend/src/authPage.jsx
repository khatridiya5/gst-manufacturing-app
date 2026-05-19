import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

/* ─── tiny animation helper injected once ─── */
const style = document.createElement('style')
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Space+Grotesk:wght@600;700&display=swap');
  @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .auth-card { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .auth-input:focus { outline: none; border-color: #14b8a6; box-shadow: 0 0 0 3px rgba(20,184,166,0.18); }
  .auth-btn:hover:not(:disabled) { background: #0d9488; }
  .auth-btn:active:not(:disabled) { transform: scale(0.98); }
  .tab-active { color: #14b8a6; border-bottom: 2px solid #14b8a6; }
  .tab-inactive { color: #64748b; border-bottom: 2px solid transparent; }
`
if (!document.head.querySelector('[data-auth-style]')) {
  style.setAttribute('data-auth-style', '')
  document.head.appendChild(style)
}

export default function AuthPage() {
  const [tab, setTab] = useState('login') // 'login' | 'signup'
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
      {/* Decorative background rings */}
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
        {/* Logo */}
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

        {/* Card */}
        <div style={{
          background: '#1e293b',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {['login', 'signup'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '1rem',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 500,
                transition: 'all 0.2s',
                fontFamily: "'DM Sans', sans-serif",
              }} className={tab === t ? 'tab-active' : 'tab-inactive'}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div style={{ padding: '2rem' }}>
            {tab === 'login'
              ? <LoginForm navigate={navigate} />
              : <SignupForm onSuccess={() => setTab('login')} />
            }
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#334155', marginTop: '1.5rem' }}>
          © {new Date().getFullYear()} GST Manufacturing. All rights reserved.
        </p>
      </div>
    </div>
  )
}

/* ─── LOGIN FORM ─── */
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
        type="email" value={email} placeholder="you@company.com" required
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

/* ─── SIGNUP FORM ─── */
function SignupForm({ onSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', { name, email, password })
      setSuccess('Account created! You can now sign in.')
      setTimeout(onSuccess, 2000)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Registration failed. Email may already exist.')
    } finally {
      setLoading(false)
    }
  }

  const strength = passwordStrength(password)

  return (
    <form onSubmit={handleSignup}>
      <FieldLabel>Full name</FieldLabel>
      <AuthInput
        type="text" value={name} placeholder="Your name" required
        onChange={e => setName(e.target.value)}
        icon={<UserIcon />}
      />

      <FieldLabel style={{ marginTop: '1.25rem' }}>Work email</FieldLabel>
      <AuthInput
        type="email" value={email} placeholder="you@company.com" required
        onChange={e => setEmail(e.target.value)}
        icon={<EmailIcon />}
      />

      <FieldLabel style={{ marginTop: '1.25rem' }}>Password</FieldLabel>
      <AuthInput
        type={showPass ? 'text' : 'password'} value={password}
        placeholder="Min. 8 characters" required
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
      {password && <StrengthBar strength={strength} />}

      <FieldLabel style={{ marginTop: '1.25rem' }}>Confirm password</FieldLabel>
      <AuthInput
        type={showPass ? 'text' : 'password'} value={confirm}
        placeholder="Re-enter password" required
        onChange={e => setConfirm(e.target.value)}
        icon={<LockIcon />}
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {success && (
        <div style={{
          marginTop: '1rem', padding: '12px 16px',
          background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)',
          borderRadius: '10px', color: '#14b8a6', fontSize: '14px',
        }}>{success}</div>
      )}

      <AuthButton loading={loading} style={{ marginTop: '1.75rem' }}>
        {loading ? <Spinner /> : 'Create Account'}
      </AuthButton>
    </form>
  )
}

/* ─── SHARED COMPONENTS ─── */
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

function StrengthBar({ strength }) {
  const colors = ['#ef4444', '#f97316', '#eab308', '#14b8a6']
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            flex: 1, height: '3px', borderRadius: '2px',
            background: i < strength ? colors[strength - 1] : '#1e293b',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: '12px', color: colors[strength - 1] || '#475569' }}>
        {strength > 0 ? labels[strength - 1] : ''}
      </span>
    </div>
  )
}

function Spinner() {
  return <span style={{
    display: 'inline-block', width: '16px', height: '16px',
    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  }} />
}

function passwordStrength(p) {
  if (!p) return 0
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return s
}

/* ─── INLINE SVG ICONS ─── */
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
function UserIcon() {
  return <svg style={iconStyle} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="5" r="3"/>
    <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
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