import { create } from 'zustand'

/**
 * Global store for real-time responder telemetry.
 * Updated by WebSocket messages and API fetches from backend.
 */

const useStore = create((set, get) => ({
  // ── Responders ────────────────────────────────────────────────
  responders: [],        // [{ id, badge_id, name, role, team, ... }]
  setResponders: (data) => set({ responders: Array.isArray(data) ? data : [] }),

  // ── Live Data (keyed by badge_id) ─────────────────────────────
  liveVitals: {},        // { 'NDRF-001': { heart_rate, spo2, ... } }
  liveGas:    {},        // { 'NDRF-001': { co_ppm, no2_ppm, ... } }
  liveRRI:    {},        // { 'NDRF-001': { rri, risk_level } }
  history:    {},        // { 'NDRF-001': [{ time, hr, spo2, co }, ...] }

  updateVitals: (badge_id, data) => set((state) => {
    if (!badge_id) return state
    const ts = new Date()
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const oldHistory = state.history[badge_id] || []
    
    let newHistory = oldHistory
    if (data.heart_rate != null) {
      newHistory = [...oldHistory, {
        time: timeStr,
        hr: Number(data.heart_rate),
        spo2: data.spo2 != null ? Number(data.spo2) : null,
      }].slice(-30) // Cap at last 30 data points
    }

    return {
      liveVitals: { ...state.liveVitals, [badge_id]: { ...data, ts } },
      history: { ...state.history, [badge_id]: newHistory }
    }
  }),

  updateGas: (badge_id, data) => set((state) => {
    if (!badge_id) return state
    return { liveGas: { ...state.liveGas, [badge_id]: { ...data, ts: new Date() } } }
  }),

  updateRRI: (badge_id, data) => set((state) => {
    if (!badge_id) return state
    return { liveRRI: { ...state.liveRRI, [badge_id]: { ...data, ts: new Date() } } }
  }),

  // ── Alerts (Deduped by ID) ────────────────────────────────────
  alerts: [],            // [{ id, time, alert_type, severity, message, ... }]
  unacknowledgedCount: 0,
  addAlert: (alert) => set((state) => {
    if (!alert || !alert.id) return state
    const exists = state.alerts.some(a => a.id === alert.id)
    if (exists) return state
    const newAlerts = [alert, ...state.alerts].slice(0, 100)
    return {
      alerts: newAlerts,
      unacknowledgedCount: alert.acknowledged ? state.unacknowledgedCount : state.unacknowledgedCount + 1,
    }
  }),
  acknowledgeAlert: (id) => set((state) => ({
    alerts: state.alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a),
    unacknowledgedCount: Math.max(0, state.unacknowledgedCount - 1),
  })),
  setAlerts: (alerts) => set({
    alerts: Array.isArray(alerts) ? alerts : [],
    unacknowledgedCount: Array.isArray(alerts) ? alerts.filter(a => !a.acknowledged).length : 0
  }),

  // ── Dashboard Summary ─────────────────────────────────────────
  summary: {
    total_active_responders: 0,
    alert_counts: { critical: 0, warning: 0, info: 0 },
    average_rri: 0,
    risk_distribution: {},
  },
  setSummary: (summary) => set({ summary: summary || {} }),

  // ── WebSocket connection status ───────────────────────────────
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),

  // ── Selected responder for detail view ────────────────────────
  selectedResponderId: null,
  setSelectedResponder: (id) => set({ selectedResponderId: id }),
}))

export default useStore
