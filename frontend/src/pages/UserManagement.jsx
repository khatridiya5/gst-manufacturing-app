import { useState, useEffect } from 'react'
import api from '../api/client'

const SECTIONS = [
  { key: 'purchase',   label: 'Purchase',   icon: '📦', color: '#3b82f6', bg: '#1e3a5f' },
  { key: 'sales',      label: 'Sales',      icon: '🧾', color: '#10b981', bg: '#064e3b' },
  { key: 'production', label: 'Production', icon: '🏭', color: '#f59e0b', bg: '#451a03' },
  { key: 'store',      label: 'In-Store',   icon: '🏪', color: '#a78bfa', bg: '#2e1065' },
]

export default function UserManagement() {
  const [creds, setCreds] = useState([])
  const [loading, setLoading] = useState(true)
  const [forms, setForms] = useState({
    purchase:   { username: '', password: '', confirm: '' },
    sales:      { username: '', password: '', confirm: '' },
    production: { username: '', password: '', confirm: '' },
    store:      { username: '', password: '', confirm: '' },
  })
  const [status, setStatus] = useState({}) // { section: 'success' | 'error' | 'loading' }
  const [messages, setMessages] = useState({})

  const section = localStorage.getItem('active_section') || 'admin'
  const token = localStorage.getItem(`token_${section}`)
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchCreds()
  }, [])

  const fetchCreds = async () => {
    setLoading(true)
    try {
      const res = await api.get('/auth/setup/section-credentials', { headers })
      setCreds(res.data)
      // Pre-fill usernames
      const updated = { ...forms }
      res.data.forEach(c => {
        if (updated[c.section]) updated[c.section].username = c.username
      })
      setForms(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (section) => {
    const { username, password, confirm } = forms[section]
    if (!username) return setMessages(m => ({ ...m, [section]: 'Username is required' }))
    if (password && password !== confirm) return setMessages(m => ({ ...m, [section]: 'Passwords do not match' }))
    if (password && password.length < 6) return setMessages(m => ({ ...m, [section]: 'Password must be at least 6 characters' }))

    setStatus(s => ({ ...s, [section]: 'loading' }))
    setMessages(m => ({ ...m, [section]: '' }))
    try {
      await api.post('/auth/setup/section-credentials',
        { section, username, password: password || undefined },
        { headers }
      )
      setStatus(s => ({ ...s, [section]: 'success' }))
      setMessages(m => ({ ...m, [section]: 'Saved successfully!' }))
      setForms(f => ({ ...f, [section]: { ...f[section], password: '', confirm: '' } }))
      fetchCreds()
      setTimeout(() => setStatus(s => ({ ...s, [section]: '' })), 3000)
    } catch (e) {
      setStatus(s => ({ ...s, [section]: 'error' }))
      const detail = e?.response?.data?.detail
      setMessages(m => ({ ...m, [section]: typeof detail === 'string' ? detail : 'Failed to save' }))
    }
  }

  const isConfigured = (section) => creds.some(c => c.section === section)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: '#94a3b8', fontSize: 15 }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>
          ⚙️ User Management
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Manage login credentials for each section. Workers use these to log in.
        </p>
      </div>

      {/* Status overview */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '2rem'
      }}>
        {SECTIONS.map(s => (
          <div key={s.key} style={{
            background: '#1e293b', borderRadius: 12, padding: '1rem',
            border: `1px solid ${isConfigured(s.key) ? s.color + '55' : '#334155'}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{s.label}</div>
            <div style={{
              marginTop: 6, fontSize: 11, fontWeight: 600,
              color: isConfigured(s.key) ? '#10b981' : '#ef4444'
            }}>
              {isConfigured(s.key) ? '✓ Configured' : '✗ Not set'}
            </div>
          </div>
        ))}
      </div>

      {/* Section cards */}
      {SECTIONS.map(({ key, label, icon, color, bg }) => (
        <div key={key} style={{
          background: '#1e293b',
          border: `1px solid ${isConfigured(key) ? color + '44' : '#334155'}`,
          borderRadius: 16, padding: '1.5rem', marginBottom: '1.25rem'
        }}>
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18
              }}>{icon}</div>
              <div>
                <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>{label} Section</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  {isConfigured(key)
                    ? `Username: ${creds.find(c => c.section === key)?.username}`
                    : 'No credentials set yet'}
                </div>
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
              background: isConfigured(key) ? '#064e3b' : '#450a0a',
              color: isConfigured(key) ? '#10b981' : '#ef4444',
            }}>
              {isConfigured(key) ? 'ACTIVE' : 'NOT SET'}
            </span>
          </div>

          {/* Form */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text"
                placeholder={`${key}_user`}
                value={forms[key].username}
                onChange={e => setForms(f => ({ ...f, [key]: { ...f[key], username: e.target.value } }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                New Password
              </label>
              <input
                type="password"
                placeholder="Leave blank to keep current"
                value={forms[key].password}
                onChange={e => setForms(f => ({ ...f, [key]: { ...f[key], password: e.target.value } }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={forms[key].confirm}
                onChange={e => setForms(f => ({ ...f, [key]: { ...f[key], confirm: e.target.value } }))}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Message */}
          {messages[key] && (
            <div style={{
              marginTop: 10, fontSize: 13, padding: '8px 12px', borderRadius: 8,
              background: status[key] === 'success' ? '#064e3b' : '#450a0a',
              color: status[key] === 'success' ? '#10b981' : '#f87171',
              border: `1px solid ${status[key] === 'success' ? '#10b98133' : '#ef444433'}`,
            }}>
              {messages[key]}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={() => handleSave(key)}
            disabled={status[key] === 'loading'}
            style={{
              marginTop: 14, padding: '9px 20px',
              background: status[key] === 'success' ? '#064e3b' : color,
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: status[key] === 'loading' ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {status[key] === 'loading' ? 'Saving...'
              : status[key] === 'success' ? '✓ Saved!'
              : isConfigured(key) ? `Update ${label} Credentials`
              : `Set ${label} Credentials`}
          </button>
        </div>
      ))}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 12px',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 13,
  outline: 'none',
}