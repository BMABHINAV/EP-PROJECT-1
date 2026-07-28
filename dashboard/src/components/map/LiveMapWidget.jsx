import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import useStore from '../../store/useStore'

// Stable positions based on badge_id seed
function seededPos(seed, base = [12.9716, 77.5946], spread = 0.04) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h) + seed.charCodeAt(i), h |= 0
  const r = () => { h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); return (h & 0xffff) / 0xffff }
  return [base[0] + (r() - 0.5) * spread * 2, base[1] + (r() - 0.5) * spread * 2]
}

const RISK_COLOR = { normal: '#22c55e', caution: '#f59e0b', warning: '#f97316', critical: '#ef4444' }

// Colored SVG marker
function makeIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34">
      <circle cx="14" cy="14" r="12" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="6" fill="${color}"/>
      <line x1="14" y1="26" x2="14" y2="34" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>`
  return L.divIcon({
    html: svg,
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -34],
    className: '',
  })
}

export default function LiveMapWidget() {
  const { responders, liveRRI, liveVitals } = useStore()

  const positions = useMemo(() =>
    responders.map(r => ({ ...r, pos: seededPos(r.badge_id) })),
    [responders.length]
  )

  return (
    <div className="h-full w-full rounded-lg overflow-hidden relative">
      <MapContainer
        center={[12.9716, 77.5946]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Base camp marker */}
        <CircleMarker
          center={[12.9716, 77.5946]}
          radius={10}
          pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.3, color: '#3b82f6', weight: 2 }}
        >
          <Popup>
            <div className="text-xs font-semibold text-slate-800">⛺ Base Camp</div>
          </Popup>
        </CircleMarker>

        {/* Responder markers */}
        {positions.map(r => {
          const rri = liveRRI[r.badge_id] || {}
          const v   = liveVitals[r.badge_id] || {}
          const risk = rri.risk_level || 'normal'
          const color = RISK_COLOR[risk] || RISK_COLOR.normal
          return (
            <Marker key={r.id} position={r.pos} icon={makeIcon(color)}>
              <Popup>
                <div style={{ fontSize: 11, lineHeight: 1.6, minWidth: 130 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.name}</div>
                  <div>Badge: <b>{r.badge_id}</b></div>
                  <div>Risk: <b style={{ color }}>{risk.toUpperCase()}</b></div>
                  {v.heart_rate && <div>HR: <b>{Number(v.heart_rate).toFixed(0)} bpm</b></div>}
                  {v.spo2 && <div>SpO2: <b>{Number(v.spo2).toFixed(1)}%</b></div>}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 z-[999] flex gap-2 flex-wrap">
        {[['#22c55e','Safe'], ['#f59e0b','Warning'], ['#ef4444','Critical'], ['#3b82f6','Base Camp']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dash-card/90 border border-dash-border2 text-[9px] text-slate-300 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full" style={{ background: c }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}
