import { useState, useEffect, useCallback } from 'react'
import { LayoutGrid, Gauge, Search, PlusCircle, Send, QrCode, LogOut } from 'lucide-react'
import { client } from './neonClient'
import { dictionary } from './i18n'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Registry from './components/Registry'
import AddItem from './components/AddItem'
import DrawRequests from './components/DrawRequests'

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [lang, setLang] = useState('en')
  const [view, setView] = useState('dashboard')

  const [machines, setMachines] = useState([])
  const [parts, setParts] = useState([])
  const [draws, setDraws] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')

  const [qrScanInput, setQrScanInput] = useState('')
  const [qrNotice, setQrNotice] = useState('')
  const [filter, setFilter] = useState('')

  const t = dictionary[lang]

  // ---- auth session (Neon Auth) ----
  const loadSession = useCallback(async () => {
    const { data } = await client.auth.getSession()
    setSession(data?.session ?? null)
    setAuthReady(true)
  }, [])

  useEffect(() => { loadSession() }, [loadSession])

  const signOut = async () => {
    await client.auth.signOut()
    await loadSession()
  }

  // ---- data loading ----
  const refresh = useCallback(async () => {
    setLoadErr('')
    const [m, p, d] = await Promise.all([
      client.from('machines').select('*').order('id'),
      client.from('spare_parts').select('*').order('id'),
      client.from('draw_requests').select('*').order('created_at', { ascending: false }).limit(200),
    ])
    if (m.error || p.error || d.error) {
      setLoadErr((m.error || p.error || d.error).message)
      setLoading(false)
      return
    }
    setMachines(m.data)
    setParts(p.data)
    setDraws(d.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session) {
      setLoading(true)
      refresh()
    }
  }, [session, refresh])

  const navigateToRegistry = (id) => {
    setFilter(id)
    setView('registry')
  }

  const handleQrScan = (e) => {
    e.preventDefault()
    const code = qrScanInput.trim()
    if (!code) return
    const hit =
      machines.find((m) => m.id.toLowerCase() === code.toLowerCase()) ||
      parts.find((p) => p.id.toLowerCase() === code.toLowerCase())
    setQrNotice(hit ? `${t.scanSuccess}${code}` : `${t.scanFail}"${code}"`)
    if (hit) navigateToRegistry(code)
    setTimeout(() => setQrNotice(''), 4000)
  }

  if (!authReady) return <div className="center-note">…</div>
  if (!session) {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <button className="lang-btn" onClick={() => setLang(lang === 'en' ? 'kh' : 'en')} style={{ color: '#5b6673' }}>
            {lang === 'en' ? 'ខ្មែរ' : 'EN'}
          </button>
        </div>
        <Login t={t} onAuthed={loadSession} />
      </div>
    )
  }

  const lowStockCount = parts.filter((p) => p.stock <= p.min_stock).length

  return (
    <div className="fia-root">
      <header className="fia-head">
        <div className="fia-brand">
          <LayoutGrid size={18} />
          <div>
            <div className="fia-title">{t.title}</div>
            <div className="fia-sub">{t.sub}</div>
          </div>
        </div>
        <div className="fia-right-controls">
          <div className="lang-toggle">
            <button className={`lang-btn ${lang === 'en' ? 'on' : ''}`} onClick={() => setLang('en')}>EN</button>
            <button className={`lang-btn ${lang === 'kh' ? 'on' : ''}`} onClick={() => setLang('kh')}>ខ្មែរ</button>
          </div>
          <nav className="fia-nav">
            <button className={`fia-tab ${view === 'dashboard' ? 'on' : ''}`} onClick={() => setView('dashboard')}>
              <Gauge size={14} /> {t.dashboard}
              {lowStockCount > 0 && <span className="fia-badge">{lowStockCount}</span>}
            </button>
            <button className={`fia-tab ${view === 'registry' ? 'on' : ''}`} onClick={() => setView('registry')}>
              <Search size={14} /> {t.registry}
            </button>
            <button className={`fia-tab ${view === 'add-item' ? 'on' : ''}`} onClick={() => setView('add-item')}>
              <PlusCircle size={14} /> {t.addItem}
            </button>
            <button className={`fia-tab ${view === 'requests' ? 'on' : ''}`} onClick={() => setView('requests')}>
              <Send size={14} /> {t.drawRequests}
            </button>
          </nav>
          <button className="signout-btn" onClick={signOut}>
            <LogOut size={13} /> {t.signOut}
          </button>
        </div>
      </header>

      <div className="qr-sim-bar">
        <QrCode size={18} />
        <span><strong>[{t.qrSim}]:</strong></span>
        <form onSubmit={handleQrScan} className="qr-input-wrap">
          <input type="text" placeholder={t.placeholderScan} value={qrScanInput} onChange={(e) => setQrScanInput(e.target.value)} />
          <button type="submit">{t.triggerScan}</button>
        </form>
        {qrNotice && <span style={{ color: '#1abc9c', fontWeight: 'bold', marginLeft: 10 }}>{qrNotice}</span>}
      </div>

      {loadErr ? (
        <div className="center-note" style={{ color: 'var(--bad)' }}>{t.loadError}<br /><small>{loadErr}</small></div>
      ) : loading ? (
        <div className="center-note">{t.loading}</div>
      ) : (
        <div>
          {view === 'dashboard' && <Dashboard t={t} machines={machines} parts={parts} draws={draws} navigateToRegistry={navigateToRegistry} />}
          {view === 'registry' && <Registry t={t} machines={machines} parts={parts} filter={filter} setFilter={setFilter} refresh={refresh} />}
          {view === 'add-item' && <AddItem t={t} setView={setView} refresh={refresh} />}
          {view === 'requests' && <DrawRequests t={t} parts={parts} draws={draws} refresh={refresh} />}
        </div>
      )}
    </div>
  )
}
