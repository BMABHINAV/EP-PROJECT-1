import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const WS_URL   = import.meta.env.VITE_WS_URL       || 'ws://localhost:8000'

export const api = axios.create({ baseURL: API_BASE })

// ─────────────────────────────────────────────────────────────────────
// REST API helpers
// ─────────────────────────────────────────────────────────────────────

export const fetchResponders   = () => api.get('/api/v1/responders/').then(r => r.data)
export const fetchSummary      = () => api.get('/api/v1/dashboard/summary').then(r => r.data)
export const fetchResponderCards = () => api.get('/api/v1/dashboard/responder-cards').then(r => r.data)
export const fetchMissions     = () => api.get('/api/v1/missions/').then(r => r.data)
export const fetchAlerts       = (params = {}) => api.get('/api/v1/alerts/', { params }).then(r => r.data)
export const acknowledgeAlert  = (id) => api.patch(`/api/v1/alerts/${id}/acknowledge`).then(r => r.data)
export const resolveAlert      = (id) => api.patch(`/api/v1/alerts/${id}/resolve`).then(r => r.data)

// ─────────────────────────────────────────────────────────────────────
// WebSocket connection
// ─────────────────────────────────────────────────────────────────────

export class DashboardWebSocket {
  constructor(onMessage, onStatus = () => {}) {
    this.onMessage = onMessage
    this.onStatus = onStatus
    this.ws = null
    this.reconnectDelay = 2000
    this.maxDelay = 30000
    this.connected = false
    this._manualDisconnect = false
  }

  connect() {
    this._manualDisconnect = false
    try {
      this.ws = new WebSocket(`${WS_URL}/ws/dashboard`)

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected')
        this.connected = true
        this.onStatus(true)
        this.reconnectDelay = 2000
        // Send heartbeat every 30s
        this._heartbeatInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send('ping')
          }
        }, 30000)
      }

      this.ws.onmessage = (event) => {
        try {
          if (event.data === 'pong' || event.data === 'ping') return
          const msg = JSON.parse(event.data)
          this.onMessage(msg)
        } catch (e) {
          if (event.data !== 'pong') console.error('WS parse error:', e)
        }
      }

      this.ws.onerror = (e) => {
        // Silent catch during page unmount
      }

      this.ws.onclose = () => {
        this.connected = false
        this.onStatus(false)
        clearInterval(this._heartbeatInterval)
        if (!this._manualDisconnect) {
          setTimeout(() => this.connect(), this.reconnectDelay)
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay)
        }
      }
    } catch (err) {
      console.warn('WebSocket connect error:', err)
    }
  }

  disconnect() {
    this._manualDisconnect = true
    clearInterval(this._heartbeatInterval)
    this.ws?.close()
  }
}
