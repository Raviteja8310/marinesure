import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach the current access token to every request.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/register']
let refreshPromise = null

function clearSessionAndGoToLogin() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

// Access tokens are short-lived (15 minutes). On a 401, exchange the refresh
// token for a new pair once (shared by concurrent requests) and retry, so the
// user is only sent to the login page when the session has really ended.
async function refreshTokens() {
  const refresh_token = localStorage.getItem('refresh_token')
  if (!refresh_token) throw new Error('No refresh token')
  const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token })
  localStorage.setItem('access_token', data.access_token)
  localStorage.setItem('refresh_token', data.refresh_token)
  if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
  return data.access_token
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {}
    const status = error.response?.status
    const isAuthCall = AUTH_PATHS.some((p) => (original.url || '').includes(p))

    if (status !== 401 || isAuthCall) {
      return Promise.reject(error)
    }
    if (original._retried) {
      clearSessionAndGoToLogin()
      return Promise.reject(error)
    }
    try {
      refreshPromise = refreshPromise || refreshTokens().finally(() => { refreshPromise = null })
      const token = await refreshPromise
      original._retried = true
      original.headers = { ...(original.headers || {}), Authorization: `Bearer ${token}` }
      return api(original)
    } catch {
      clearSessionAndGoToLogin()
      return Promise.reject(error)
    }
  },
)

export default api
