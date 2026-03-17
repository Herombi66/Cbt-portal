import axios from 'axios'

// Defensively check for VITE_API_BASE_URL
const API_BASE: string = (function() {
  try {
    return (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';
  } catch {
    return 'http://localhost:8000';
  }
})();

let accessToken: string | null = null

export function setTokens(token: string | null) {
  accessToken = token
  if (token) {
    localStorage.setItem('access_token', token)
  } else {
    localStorage.removeItem('access_token')
  }
}

export function loadTokensFromStorage() {
  accessToken = localStorage.getItem('access_token')
}

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
})

api.interceptors.request.use(cfg => {
  if (accessToken) {
    cfg.headers = cfg.headers || {}
    cfg.headers.Authorization = `Bearer ${accessToken}`
  }
  return cfg
})

api.interceptors.response.use(
  r => r,
  async err => {
    const { config, response } = err
    const status = response?.status

    if (status === 401) {
      setTokens(null)
    }

    // Simple retry mechanism for GET requests on network errors or 5xx
    const isGet = config?.method?.toLowerCase() === 'get'
    const isRetryable = !response || (status >= 500 && status <= 599)
    const retryCount = config?.__retryCount || 0

    if (isGet && isRetryable && retryCount < 3) {
      config.__retryCount = retryCount + 1
      const delay = Math.pow(2, retryCount) * 1000 // exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay))
      return api(config)
    }

    return Promise.reject(err)
  }
)
