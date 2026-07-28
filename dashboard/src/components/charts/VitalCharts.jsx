import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { format } from 'date-fns'

const TOOLTIP_STYLE = {
  backgroundColor: '#161d2e',
  border: '1px solid #1e2d4a',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: 12,
}

/**
 * Reusable vital chart — wraps Recharts AreaChart with consistent styling.
 */
export function VitalChart({ data, dataKey, color, unit, referenceValue, label, height = 160 }) {
  const formatted = data.map(d => ({
    ...d,
    time: format(new Date(d.time || Date.now()), 'HH:mm:ss')
  }))

  return (
    <div className="chart-container" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#475569' }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
          {referenceValue && (
            <ReferenceLine
              y={referenceValue}
              stroke="var(--clr-critical)"
              strokeDasharray="4 4"
              label={{ value: 'Threshold', position: 'right', fontSize: 10, fill: 'var(--clr-critical)' }}
            />
          )}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${value.toFixed(2)} ${unit}`, label]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#gradient-${dataKey})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Multi-line chart for overlaying multiple vitals.
 */
export function MultiLineChart({ data, lines, height = 200 }) {
  return (
    <div className="chart-container" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#475569' }} />
          <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {lines.map(({ key, color, name }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              dot={false}
              name={name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * RRI Gauge visualization.
 */
export function RRIGauge({ rri }) {
  const percent = rri * 100
  const color =
    rri < 0.3 ? 'var(--clr-normal)'   :
    rri < 0.6 ? 'var(--clr-caution)'  :
    rri < 0.8 ? 'var(--clr-warning)'  : 'var(--clr-critical)'

  const label =
    rri < 0.3 ? 'Normal'   :
    rri < 0.6 ? 'Caution'  :
    rri < 0.8 ? 'Warning'  : 'Critical'

  return (
    <div style={{ textAlign: 'center', padding: 12 }}>
      <svg viewBox="0 0 120 80" width="100%" style={{ maxWidth: 200 }}>
        {/* Background arc */}
        <path
          d="M 10 70 A 50 50 0 0 1 110 70"
          fill="none"
          stroke="var(--clr-border)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Filled arc based on RRI */}
        <path
          d="M 10 70 A 50 50 0 0 1 110 70"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${percent * 1.57} 157`}
        />
        {/* Value text */}
        <text x="60" y="62" textAnchor="middle" fill={color} fontSize="16" fontWeight="700"
              fontFamily="JetBrains Mono, monospace">
          {percent.toFixed(0)}%
        </text>
        <text x="60" y="76" textAnchor="middle" fill="var(--clr-text-muted)" fontSize="9">
          {label}
        </text>
      </svg>
    </div>
  )
}

/**
 * Gas bar chart — shows all 4 gas levels with IDLH reference lines.
 */
export function GasBarChart({ data }) {
  const chartData = [
    { name: 'CO', value: data.co_ppm     ?? 0, limit: 50,   unit: 'ppm',  color: '#a78bfa' },
    { name: 'NO2', value: data.no2_ppm   ?? 0, limit: 5,    unit: 'ppm',  color: '#f43f5e' },
    { name: 'NH3', value: data.nh3_ppm   ?? 0, limit: 300,  unit: 'ppm',  color: '#fb923c' },
    { name: 'O2',  value: data.o2_percent ?? 20.9, limit: 19.5, unit: '%', color: '#06b6d4' },
  ]

  return (
    <div className="chart-container" style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name, props) => [
              `${value.toFixed(2)} ${props.payload.unit}`, props.payload.name
            ]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <rect key={i} fill={entry.value > entry.limit ? 'var(--clr-critical)' : entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
