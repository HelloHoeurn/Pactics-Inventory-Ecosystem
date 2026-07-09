import { useState } from 'react'
import { AlertCircle, CheckCircle, ChevronRight, Download, TrendingUp, BarChart3 } from 'lucide-react'
import { exportCSV } from '../lib/csv'

export default function Dashboard({ t, machines, parts, draws, navigateToRegistry }) {
  const lowStock = parts.filter((p) => p.stock <= p.min_stock)

  const exportReorder = () => {
    const cols = [
      { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'model', label: 'Model' },
      { key: 'stock', label: 'CurrentStock' }, { key: 'min_stock', label: 'GuardLevel' },
      { key: 'deficit', label: 'Deficit' }, { key: 'bin', label: 'Bin' },
    ]
    exportCSV('reorder_list.csv', cols, lowStock.map((p) => ({ ...p, deficit: p.min_stock - p.stock })))
  }

  return (
    <div style={{ background: '#fff', minHeight: 480 }}>
      <div className="kpis">
        <div className="kpi"><div className="kpi-n">{machines.length}</div><div className="kpi-l">{t.kpiMachines}</div></div>
        <div className="kpi"><div className="kpi-n">{parts.length}</div><div className="kpi-l">{t.kpiParts}</div></div>
        <div className="kpi">
          <div className="kpi-n" style={{ color: lowStock.length > 0 ? 'var(--bad)' : 'var(--ok)' }}>{lowStock.length}</div>
          <div className="kpi-l">{t.kpiAlerts}</div>
        </div>
      </div>

      <StockChart t={t} parts={parts} draws={draws} />

      <div style={{ padding: '0 24px 24px' }}>
        <div className="sec-head-row">
          <h3><AlertCircle size={18} color={lowStock.length > 0 ? 'var(--bad)' : 'var(--ok)'} /> {t.procurementTitle}</h3>
          <button className="btn-sec" onClick={exportReorder} disabled={lowStock.length === 0}>
            <Download size={14} /> {t.exportReorder}
          </button>
        </div>

        <div className="list" style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', maxHeight: 'none' }}>
          {lowStock.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--ink2)', fontSize: 14, background: 'var(--panel2)' }}>
              <CheckCircle size={32} color="var(--ok)" style={{ marginBottom: 12 }} /><br />{t.allBalanced}
            </div>
          ) : lowStock.map((p) => (
            <button key={p.id} className="row" onClick={() => navigateToRegistry(p.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="row-main">
                  <span className="mono tag" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>{p.id}</span>
                  <span className="row-name">{p.name}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--bad)', fontWeight: 600, marginTop: 6 }}>
                  {t.currentStock}: {p.stock} ({t.guardLevel}: {p.min_stock})
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{t.bin}: {p.bin} <ChevronRight size={14} style={{ verticalAlign: 'middle' }} /></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StockChart({ t, parts, draws }) {
  const [mode, setMode] = useState('levels')
  const sorted = [...parts].sort((a, b) => (a.stock - a.min_stock) - (b.stock - b.min_stock))
  const maxVal = Math.max(1, ...parts.map((p) => Math.max(p.stock, p.min_stock)))

  // Trend reconstructed from real draw history:
  // walk backwards from current total, adding back each drawn qty.
  const currentTotal = parts.reduce((s, p) => s + p.stock, 0)
  const recent = [...draws].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(-20)
  const drawnInWindow = recent.reduce((s, d) => s + (d.qty || 1), 0)
  const series = []
  let running = currentTotal + drawnInWindow
  series.push({ label: 'start', total: running })
  for (const d of recent) {
    running -= d.qty || 1
    series.push({ label: new Date(d.created_at).toLocaleTimeString(), total: running })
  }

  const W = 320, H = 130, pad = { l: 10, r: 10, t: 14, b: 20 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const totals = series.map((p) => p.total)
  const minT = Math.min(...totals), maxT = Math.max(...totals)
  const span = maxT - minT || 1
  const pts = series.map((p, i) => {
    const x = pad.l + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw)
    const y = pad.t + ih - ((p.total - minT) / span) * ih
    return [x, y]
  })
  const line = pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')
  const area = pts.length
    ? `M${pts[0][0].toFixed(1)},${(pad.t + ih).toFixed(1)} ` +
      pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') +
      ` L${pts[pts.length - 1][0].toFixed(1)},${(pad.t + ih).toFixed(1)} Z`
    : ''
  const last = pts[pts.length - 1]

  return (
    <div className="chart-wrap">
      <div className="chart-card">
        <div className="chart-head">
          <div className="chart-h-title"><TrendingUp size={15} /> {t.chartTitle}</div>
          <div className="seg-toggle">
            <button className={`seg-t ${mode === 'levels' ? 'on' : ''}`} onClick={() => setMode('levels')}><BarChart3 size={13} /> {t.chartLevels}</button>
            <button className={`seg-t ${mode === 'trend' ? 'on' : ''}`} onClick={() => setMode('trend')}><TrendingUp size={13} /> {t.chartTrend}</button>
          </div>
        </div>

        {mode === 'levels' ? (
          <div>
            {sorted.map((p) => {
              const low = p.stock <= p.min_stock
              const fillPct = Math.min(100, (p.stock / maxVal) * 100)
              const guardPct = Math.min(100, (p.min_stock / maxVal) * 100)
              return (
                <div key={p.id} className="bar-row">
                  <div className="bar-top">
                    <span><span className="mono tag" style={{ marginRight: 8 }}>{p.id}</span><span className="b-name">{p.name}</span></span>
                    <span className="b-val" style={{ color: low ? 'var(--bad)' : 'var(--ok)' }}>{p.stock}</span>
                  </div>
                  <div className="bar-wrap">
                    <div className="bar-track"><div className="bar-fill" style={{ width: fillPct + '%', background: low ? 'var(--bad)' : 'var(--accent)' }} /></div>
                    <div className="bar-guard" style={{ left: guardPct + '%' }} title={`${t.guardLevel}: ${p.min_stock}`} />
                  </div>
                </div>
              )
            })}
            <div className="chart-legend">
              <span><span className="lg-dot" style={{ background: 'var(--accent)' }} />{t.chartStockLegend}</span>
              <span><span className="lg-dot" style={{ background: 'var(--bad)' }} />{t.kpiAlerts}</span>
              <span><span className="lg-dot" style={{ background: 'var(--ink)', width: 2, height: 12, borderRadius: 0 }} />{t.chartGuardLegend}</span>
            </div>
          </div>
        ) : (
          <div>
            {series.length < 2 ? (
              <div className="trend-hint">{t.chartTrendHint}</div>
            ) : (
              <div>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} preserveAspectRatio="xMidYMid meet">
                  <line x1={pad.l} y1={pad.t} x2={W - pad.r} y2={pad.t} stroke="var(--line)" strokeDasharray="3 3" />
                  <line x1={pad.l} y1={pad.t + ih} x2={W - pad.r} y2={pad.t + ih} stroke="var(--line)" />
                  <text x={pad.l} y={pad.t - 4} fontSize="9" fill="var(--muted)">{maxT}</text>
                  <text x={pad.l} y={pad.t + ih + 13} fontSize="9" fill="var(--muted)">{minT}</text>
                  <path d={area} fill="var(--accent-bg)" />
                  <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {last && <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--accent)" />}
                </svg>
                <div className="trend-last">{t.chartTotalUnits}: <strong>{currentTotal}</strong></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
