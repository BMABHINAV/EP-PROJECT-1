import { create } from 'zustand'

/**
 * Global store for real-time responder data.
 * Updated by WebSocket messages from backend.
 */

const useStore = create((set, get) => ({
  // ── Responders ────────────────────────────────────────────────
  responders: [],        // [{ id, badge_id, name, role, team, ... }]
  setResponders: (data) => set({ responders: data }),

  // ── Live Data (keyed by badge_id) ─────────────────────────────
  liveVitals: {},        // { 'NDRF-001': { heart_rate, spo2, ... } }
  liveGas:    {},        // { 'NDRF-001': { co_ppm, no2_ppm, ... } }
  liveRRI:    {},        // { 'NDRF-001': { rri, risk_level } }
  history:    {},        // { 'NDRF-001': [{ time, hr, spo2, co }, ...] }

  updateVitals: (badge_id, data) => set((state) => {
    const ts = new Date()
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const oldHistory = state.history[badge_id] || []
    
    // Only add a new history point if we have a valid heart rate
    let newHistory = oldHistory
    if (data.heart_rate != null) {
      newHistory = [...oldHistory, {
        time: timeStr,
        hr: data.heart_rate,
        spo2: data.spo2,
      }].slice(-30) // Keep last 30 data points
    }

    return {
      liveVitals: { ...state.liveVitals, [badge_id]: { ...data, ts } },
      history: { ...state.history, [badge_id]: newHistory }
    }
  }),

  updateGas: (badge_id, data) => set((state) => ({
    liveGas: { ...state.liveGas, [badge_id]: { ...data, ts: new Date() } }
  })),

  updateRRI: (badge_id, data) => set((state) => ({
    liveRRI: { ...state.liveRRI, [badge_id]: { ...data, ts: new Date() } }
  })),

  // ── Alerts ────────────────────────────────────────────────────
  alerts: [],            // [{ id, time, alert_type, severity, message, ... }]
  unacknowledgedCount: 0,
  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts].slice(0, 100),
    unacknowledgedCount: state.unacknowledgedCount + 1,
  })),
  acknowledgeAlert: (id) => set((state) => ({
    alerts: state.alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a),
    unacknowledgedCount: Math.max(0, state.unacknowledgedCount - 1),
  })),
  setAlerts: (alerts) => set({
    alerts,
    unacknowledgedCount: alerts.filter(a => !a.acknowledged).length
  }),

  // ── Dashboard Summary ─────────────────────────────────────────
  summary: {
    total_active_responders: 0,
    alert_counts: { critical: 0, warning: 0, info: 0 },
    average_rri: 0,
    risk_distribution: {},
  },
  setSummary: (summary) => set({ summary }),

  // ── WebSocket connection status ───────────────────────────────
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),

  // ── Selected responder for detail view ────────────────────────
  selectedResponderId: null,
  setSelectedResponder: (id) => set({ selectedResponderId: id }),
}))

export default useStore
