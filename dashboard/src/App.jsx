import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import TopBar from './components/cards/TopBar'
import Sidebar from './components/cards/Sidebar'
import DashboardPage from './pages/DashboardPage'
import AlertsPage from './pages/AlertsPage'
import RespondersPage from './pages/RespondersPage'
import MissionPage from './pages/MissionPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AIPredictionsPage from './pages/AIPredictionsPage'
import LiveMapPage from './pages/LiveMapPage'
import useStore from './store/useStore'
import { DashboardWebSocket, fetchResponders, fetchSummary, fetchAlerts, fetchResponderCards } from './services/api'

export default function App() {
  const {
    setResponders, updateVitals, updateGas, updateRRI,
    addAlert, setSummary, setAlerts, setWsConnected
  } = useStore()

  const wsRef = useRef(null)

  useEffect(() => {
    const loadDashboardState = async () => {
      try {
        const [respondersRes, summaryRes, alertsRes, cardsRes] = await Promise.allSettled([
          fetchResponders(),
          fetchSummary(),
          fetchAlerts({ acknowledged: false }),
          fetchResponderCards(),
        ])

        if (respondersRes.status === 'fulfilled') setResponders(respondersRes.value)
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value)
        if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value)

        if (cardsRes.status === 'fulfilled') {
          const cards = cardsRes.value?.responder_cards || []
          cards.forEach((card) => {
            if (card.vitals && Object.keys(card.vitals).length) updateVitals(card.badge_id, { badge_id: card.badge_id, ...card.vitals })
            if (card.rri != null) updateRRI(card.badge_id, { badge_id: card.badge_id, rri: card.rri, risk_level: card.risk_level })
          })
        }
      } catch (e) {
        console.error(e)
      }
    }

    loadDashboardState()
    const iv = setInterval(() => {
      loadDashboardState()
    }, 30000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const ws = new DashboardWebSocket((msg) => {
      const { type, data } = msg
      if (type === 'vitals_update')   updateVitals(data.badge_id, data)
      if (type === 'gas_update')      updateGas(data.badge_id, data)
      if (type === 'rri_update')      updateRRI(data.badge_id, data)
      if (type === 'alert_triggered') addAlert(data)
    }, setWsConnected)
    ws.connect()
    wsRef.current = ws
    return () => ws.disconnect()
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-dash-bg text-slate-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"            element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"   element={<DashboardPage />} />
            <Route path="/responders"  element={<RespondersPage />} />
            <Route path="/alerts"      element={<AlertsPage />} />
            <Route path="/mission"     element={<MissionPage />} />
            <Route path="/analytics"   element={<AnalyticsPage />} />
            <Route path="/ai"          element={<AIPredictionsPage />} />
            <Route path="/map"         element={<LiveMapPage />} />
            <Route path="*"            element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
