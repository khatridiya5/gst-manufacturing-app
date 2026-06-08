import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
})

// Attach token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to login if token expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
  const isLoginRequest = error.config?.url?.includes('/auth/login')
  if (!isLoginRequest) {
    localStorage.removeItem('token')
    window.location.href = '/login'
     // ADD THIS LINE:
    
    return Promise.reject(error)


  }
}
    return Promise.reject(error)
  }
)
// Keep Render backend alive — ping every 10 minutes
setInterval(() => {
  fetch('https://gst-manufacturing-backend.onrender.com')
    .catch(() => {}) // silent fail
}, 10 * 60 * 1000)
export default api