import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline } from 'react-leaflet'
import L from 'leaflet'
import useStore from '../../store/useStore'

function seededPos(seed, base = [12.9716, 77.5946], spread = 0.035) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h) + seed.charCodeAt(i), h |= 0
  const r = () => { h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); return (h & 0xffff) / 0xffff }
  return [base[0] + (r() - 0.5) * spread * 2, base[1] + (r() - 0.5) * spread * 2]
}

const BASE = [12.9716, 77.5946]
const RISK_COLOR = { normal: '#22C55E', caution: '#F59E0B', warning: '#F97316', critical: '#EF4444' }
const RISK_GLOW  = { normal: 'rgba(34,197,94,0.6)', caution: 'rgba(245,158,11,0.6)', warning: 'rgba(249,115,22,0.6)', critical: 'rgba(239,68,68,0.8)' }

function makeIcon(color, glow, risk) {
  const isCrit = risk === 'critical'
  const html = `
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <div class="${isCrit ? 'map-ring-fast' : 'map-ring'}" style="
        position:absolute;width:28px;height:28px;
        border:2px solid ${color};
        border-radius:50%;
        opacity:0.6;
      "></div>
      <div style="
        width:14px;height:14px;border-radius:50%;
        background:${color};
        box-shadow:0 0 10px ${glow}, 0 0 20px ${glow}50;
        border:2px solid rgba(255,255,255,0.4);
      "></div>
    </div>`
  return L.divIcon({ html, iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20], className: '' })
}

function makeBaseIcon() {
  const html = `
    <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <div style="
        position:absolute;width:24px;height:24px;border-radius:50%;
        border:2px solid #3B82F6;opacity:0.4;
        animation:map-ping 3s cubic-bezier(0,0,0.2,1) infinite;
      "></div>
      <div style="
        width:14px;height:14px;border-radius:4px;
        background:linear-gradient(135deg,#1D4ED8,#3B82F6);
        box-shadow:0 0 12px rgba(59,130,246,0.8);
        display:flex;align-items:center;justify-content:center;
        font-size:8px;color:white;font-weight:bold;
      ">⛺</div>
    </div>`
  return L.divIcon({ html, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16], className: '' })
}

export default function LiveMapWidget() {
  const { responders, liveRRI, liveVitals } = useStore()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 4000)
    return () => clearInterval(iv)
  }, [])

  const positions = useMemo(() =>
    responders.map(r => {
      const base = seededPos(r.badge_id)
      const dt = tick * 0.0003
      const driftLat = Math.sin(tick * 1.3 + r.badge_id.length) * dt
      const driftLng = Math.cos(tick * 0.9 + r.badge_id.length) * dt
      return { ...r, pos: [base[0] + driftLat, base[1] + driftLng] }
    }),
    [responders.length, tick] // eslint-disable-line
  )

  return (
    <div className="h-full w-full relative overflow-hidden" style={{ borderRadius: 12 }}>
      <MapContainer
        center={BASE}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {/* Base camp */}
        <Marker position={BASE} icon={makeBaseIcon()}>
          <Popup>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>⛺ Base Camp — Alpha HQ</div>
          </Popup>
        </Marker>

        {/* Danger zone circles */}
        {positions.filter(r => (liveRRI[r.badge_id]?.risk_level === 'critical')).map(r => (
          <CircleMarker
            key={`danger-${r.id}`}
            center={r.pos}
            radius={45}
            pathOptions={{
              fillColor: '#EF4444',
              fillOpacity: 0.08,
              color: '#EF4444',
              weight: 1.5,
              dashArray: '6 4',
              opacity: 0.5,
            }}
          />
        ))}

        {/* Route lines */}
        {positions.map(r => (
          <Polyline
            key={`route-${r.id}`}
            positions={[BASE, r.pos]}
            pathOptions={{
              color: RISK_COLOR[liveRRI[r.badge_id]?.risk_level || 'normal'],
              weight: 1.2,
              opacity: 0.3,
              dashArray: '4 8',
            }}
          />
        ))}

        {/* Responder markers */}
        {positions.map(r => {
          const rri   = liveRRI[r.badge_id]  || {}
          const v     = liveVitals[r.badge_id] || {}
          const risk  = rri.risk_level || 'normal'
          const color = RISK_COLOR[risk] || RISK_COLOR.normal
          const glow  = RISK_GLOW[risk]  || RISK_GLOW.normal
          const rriPct = rri.rri != null ? `${(rri.rri * 100).toFixed(0)}%` : '--'
          return (
            <Marker key={r.id} position={r.pos} icon={makeIcon(color, glow, risk)}>
              <Popup>
                <div style={{ fontSize: 11, lineHeight: 1.7, minWidth: 150, color: '#1e293b' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>{r.name}</div>
                  <div>Badge: <b style={{ fontFamily: 'monospace' }}>{r.badge_id}</b></div>
                  <div>Role: {r.role}</div>
                  <div>Risk: <b style={{ color }}>{risk.toUpperCase()}</b></div>
                  <div>RRI: <b style={{ color, fontFamily: 'monospace' }}>{rriPct}</b></div>
                  {v.heart_rate && <div>❤ HR: <b>{Number(v.heart_rate).toFixed(0)} bpm</b></div>}
                  {v.spo2       && <div>💧 SpO2: <b>{Number(v.spo2).toFixed(1)}%</b></div>}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Legend overlay */}
      <div
        className="absolute bottom-3 left-3 z-[999] flex flex-col gap-1.5 p-2.5 rounded-xl"
        style={{ background: 'rgba(6,12,24,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(59,130,246,0.2)' }}
      >
        <div className="text-[8px] text-slate-400 uppercase tracking-widest font-semibold mb-0.5">RISK LEVEL</div>
        {[
          ['#22C55E','Safe',   'rgba(34,197,94,0.5)'],
          ['#F59E0B','Caution','rgba(245,158,11,0.5)'],
          ['#EF4444','Critical','rgba(239,68,68,0.5)'],
          ['#3B82F6','Base Camp','rgba(59,130,246,0.5)'],
        ].map(([c, l, g]) => (
          <div key={l} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: c, boxShadow: `0 0 5px ${g}` }}
            />
            <span className="text-[9px] text-slate-300">{l}</span>
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div
        className="absolute top-3 right-3 z-[999] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
        style={{ background: 'rgba(6,12,24,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.25)' }}
      >
        <span className="live-dot" style={{ width:7, height:7 }} />
        <span className="text-[9px] text-safe font-bold tracking-widest">LIVE</span>
        <span className="text-[9px] text-slate-400 font-mono">{positions.length} units</span>
      </div>
    </div>
  )
}
