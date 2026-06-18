import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

function extractError(err, fallback) {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  return fallback
}

async function getFingerprint() {
  if (window.electronAPI) {
    return await window.electronAPI.getDeviceFingerprint()
  }
  return 'browser-dev-fingerprint'
}

export default function Activate() {
  const [licenseKey, setLicenseKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleActivate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const fingerprint = await getFingerprint()
      await api.post('/api/license/activate', {
        license_key: licenseKey.trim(),
        device_fingerprint: fingerprint,
        device_label: navigator.platform,
      })
      localStorage.setItem('license_key', licenseKey.trim())
      navigate('/login', { replace: true })
    } catch (err) {
      setError(extractError(err, 'Activation failed. Check your license key.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080c14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(15, 23, 38, 0.9)',
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: '20px',
        padding: '2rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Activate GST Manufacturing
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Enter the license key provided to you to activate this device.
        </p>

        <form onSubmit={handleActivate}>
          <label style={{
            display: 'block', fontSize: '0.72rem', fontWeight: 500,
            letterSpacing: '0.07em', textTransform: 'uppercase',
            color: '#64748b', marginBottom: '0.5rem'
          }}>
            License Key
          </label>
          <input
            value={licenseKey}
            onChange={e => setLicenseKey(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            required
            style={{
              width: '100%', padding: '0.7rem 1rem',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: '10px', color: '#f1f5f9',
              fontSize: '0.875rem', outline: 'none',
              boxSizing: 'border-box', marginBottom: '1rem',
            }}
          />

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: '8px', padding: '0.6rem 0.8rem',
              marginBottom: '1rem',
            }}>
              <div style={{ width: '5px', height: '5px', background: '#f87171', borderRadius: '50%', flexShrink: 0 }} />
              <p style={{ fontSize: '0.78rem', color: '#fca5a5', margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.8rem',
              background: loading ? 'rgba(13,148,136,0.25)' : 'linear-gradient(135deg, #0d9488, #0891b2)',
              border: 'none', borderRadius: '10px', color: '#fff',
              fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.04em',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Activating...' : 'Activate'}
          </button>
        </form>
      </div>
    </div>
  )
}