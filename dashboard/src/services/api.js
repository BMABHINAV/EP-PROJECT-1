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
export const fetchAlerts       = (params = {}) => api.get('/api/v1/alerts/', { params }).then(r => r.data)
export const acknowledgeAlert  = (id) => api.patch(`/api/v1/alerts/${id}/acknowledge`).then(r => r.data)
export const resolveAlert      = (id) => api.patch(`/api/v1/alerts/${id}/resolve`).then(r => r.data)

// ─────────────────────────────────────────────────────────────────────
// WebSocket connection
// ─────────────────────────────────────────────────────────────────────

export class DashboardWebSocket {
  constructor(onMessage) {
    this.onMessage = onMessage
    this.ws = null
    this.reconnectDelay = 2000
    this.maxDelay = 30000
    this.connected = false
  }

  connect() {
    this.ws = new WebSocket(`${WS_URL}/ws/dashboard`)

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected')
      this.connected = true
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
        // Ignore heartbeat responses
        if (event.data === 'pong' || event.data === 'ping') return
        const msg = JSON.parse(event.data)
        this.onMessage(msg)
      } catch (e) {
        // Only log if it wasn't a heartbeat
        if (event.data !== 'pong') console.error('WS parse error:', e)
      }
    }

    this.ws.onerror = (e) => {
      console.error('WebSocket error:', e)
    }

    this.ws.onclose = () => {
      this.connected = false
      clearInterval(this._heartbeatInterval)
      console.log(`🔄 WebSocket closed — reconnecting in ${this.reconnectDelay}ms`)
      setTimeout(() => this.connect(), this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay)
    }
  }

  disconnect() {
    clearInterval(this._heartbeatInterval)
    this.ws?.close()
  }
}
