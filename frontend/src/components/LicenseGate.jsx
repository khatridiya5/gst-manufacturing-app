import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../api/client'

async function getFingerprint() {
  if (window.electronAPI) {
    return await window.electronAPI.getDeviceFingerprint()
  }
  return 'browser-dev-fingerprint'
}

export default function LicenseGate({ children }) {
  const [status, setStatus] = useState('checking') // 'checking' | 'valid' | 'invalid'

  useEffect(() => {
    const checkLicense = async () => {
      const licenseKey = localStorage.getItem('license_key')
      if (!licenseKey) {
        setStatus('invalid')
        return
      }
      try {
        const fingerprint = await getFingerprint()
        await api.post('/api/license/verify', {
          license_key: licenseKey,
          device_fingerprint: fingerprint,
        })
        setStatus('valid')
      } catch (err) {
        localStorage.removeItem('license_key')
        setStatus('invalid')
      }
    }
    checkLicense()
  }, [])

  if (status === 'checking') {
    return (
      <div style={{
        minHeight: '100vh', background: '#080c14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem',
      }}>
        Checking license...
      </div>
    )
  }

  if (status === 'invalid') {
    return <Navigate to="/activate" replace />
  }

  return children
}