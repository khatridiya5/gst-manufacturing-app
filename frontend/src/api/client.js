import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
})

api.interceptors.request.use((config) => {
  const section = localStorage.getItem('active_section') || 'admin'
  const token = localStorage.getItem(`token_${section}`)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login')
      if (!isLoginRequest) {
        const section = localStorage.getItem('active_section') || 'admin'
        localStorage.removeItem(`token_${section}`)
        localStorage.removeItem(`role_${section}`)
        localStorage.removeItem('active_section')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

setInterval(() => {
  fetch('https://gst-manufacturing-backend.onrender.com').catch(() => {})
}, 10 * 60 * 1000)

export default api