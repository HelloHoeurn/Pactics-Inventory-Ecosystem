import { useState, useEffect, useRef, useMemo } from 'react'
import { Edit3, CheckCircle, UserCheck, ScanLine, X, Package, Download, Search } from 'lucide-react'
import { client } from '../neonClient'
import { exportCSV } from '../lib/csv'

// YYYY-MM-DD in the viewer's local timezone. Native <input type="date"> gives
// local calendar days; comparing UTC slices would mis-bucket rows created
// between local midnight and the UTC offset (e.g. 00:00–07:00 in ICT).
const localDay = (iso) => {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DrawRequests({ t, parts, draws, refresh }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')          // brief confirmation after an auto-submit

  // ---- history filter state (drives both the list view AND the CSV export) ----
  const [drawSearch, setDrawSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')    // 'YYYY-MM-DD' or ''
  const [dateTo, setDateTo] = useState('')

  // O(1) part-name lookup so both the list and the export can enrich rows
  const partById = useMemo(() => {
    const m = new Map()
    for (const p of parts) m.set(String(p.id), p)
    return m
  }, [parts])

  // Single source of truth for what's visible AND what gets exported.
  // If filters are cleared this collapses to the full `draws` prop.
  const visibleDraws = useMemo(() => {
    const q = drawSearch.trim().toLowerCase()
    return draws.filter((r) => {
      if (dateFrom || dateTo) {
        const day = localDay(r.created_at)
        if (dateFrom && day < dateFrom) return false
        if (dateTo && day > dateTo) return false
      }
      if (!q) return true
      const partName = partById.get(String(r.part_id))?.name || ''
      return (
        String(r.part_id || '').toLowerCase().includes(q) ||
        String(r.mechanic || '').toLowerCase().includes(q) ||
        String(r.operator_id || '').toLowerCase().includes(q) ||
        String(r.reason || '').toLowerCase().includes(q) ||
        partName.toLowerCase().includes(q)
      )
    })
  }, [draws, drawSearch, dateFrom, dateTo, partById])

  const clearFilters = () => { setDrawSearch(''); setDateFrom(''); setDateTo('') }
  const hasFilter = !!(drawSearch || dateFrom || dateTo)

  // Human-readable local date: 'YYYY-MM-DD HH:MM' (sortable as text, no TZ
  // ambiguity when opened in Excel by staff in Cambodia).
  const fmtDate = (v) => {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d)) return ''
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${mo}-${da} ${hh}:${mm}`
  }

  // Filename encodes the active date window so successive exports don't
  // overwrite each other in the Downloads folder.
  const exportDraws = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    const range = dateFrom || dateTo ? `_${dateFrom || 'start'}_to_${dateTo || stamp}` : ''
    exportCSV(
      `draw_requests${range}_${stamp}.csv`,
      [
        { key: 'id',         label: 'Request ID' },
        { key: 'mechanic',   label: 'Requester' },
        // Item Name is joined from the parts prop so the CSV is self-contained
        // (no VLOOKUP needed downstream). Falls back to the part_id when the
        // part row has been deleted from the registry.
        { key: 'part_id',    label: 'Item Name', format: (v) => partById.get(String(v))?.name || String(v ?? '') },
        { key: 'qty',        label: 'Quantity',  format: (v) => (v == null ? 1 : v) },
        // Every recorded row in draw_requests is a committed draw (the RPC
        // decrements stock atomically), so status is 'Fulfilled' for now.
        // When you add a real status column, change this format() one-liner.
        { key: 'id',         label: 'Status',    format: () => 'Fulfilled' },
        { key: 'created_at', label: 'Date',      format: fmtDate },
      ],
      visibleDraws,
    )
  }

  // Refs for the continuous-scan loop: scan part -> scan badge -> auto-submit -> back to part
  const partInputRef = useRef(null)
  const operatorInputRef = useRef(null)
  const submittingRef = useRef(false)             // guards against a double Enter

  // logged-in user (records who AUTHORIZED the draw)
  const [user, setUser] = useState(null)
  useEffect(() => {
    client.auth.getSession()
      .then(({ data }) => setUser(data?.user ?? data?.session?.user ?? null))
      .catch((e) => console.error('Could not read current user:', e))
  }, [])

  // ---- PART scan + lookup (from the already-loaded inventory) ----
  const [partInput, setPartInput] = useState('')
  const [part, setPart] = useState(null)
  const [partErr, setPartErr] = useState('')

  const matchPart = (raw) => {
    const id = String(raw ?? '').trim()
    if (!id) return null
    return parts.find((p) => String(p.id).toLowerCase() === id.toLowerCase()) || null
  }
  const findPart = (raw) => {
    const id = String(raw ?? partInput).trim()
    if (!id) { setPart(null); setPartErr(''); return null }
    const hit = matchPart(id)
    if (!hit) { setPart(null); setPartErr((t.partNotFound || 'No part found for ID') + ` "${id}".`); return null }
    setPart(hit); setPartErr('')
    return hit
  }
  useEffect(() => {
    if (!partInput.trim()) { setPart(null); setPartErr(''); return }
    const h = setTimeout(() => findPart(partInput), 250)
    return () => clearTimeout(h)
  }, [partInput, parts]) // eslint-disable-line
  const clearPart = () => { setPartInput(''); setPart(null); setPartErr('') }

  // ---- OPERATOR badge scan + lookup ----
  const [idInput, setIdInput] = useState('')
  const [operator, setOperator] = useState(null)
  const [looking, setLooking] = useState(false)
  const [lookupErr, setLookupErr] = useState('')

  // returns the employee row (or null) so the scan handler can chain straight into submit
  const lookup = async (raw) => {
    const id = String(raw ?? idInput).trim()
    if (!id) return null
    setLooking(true); setLookupErr(''); setOperator(null)
    const { data, error } = await client
      .from('employees')
      .select('employee_id,name_en,name_kh,position,department')
      .eq('employee_id', id)
      .limit(1)
    setLooking(false)
    if (error) { setLookupErr(error.message); return null }
    if (!data || data.length === 0) {
      setLookupErr((t.operatorNotFound || 'No operator found for ID') + ` "${id}".`)
      return null
    }
    setOperator(data[0])
    return data[0]
  }
  useEffect(() => {
    if (!idInput.trim()) { setOperator(null); setLookupErr(''); return }
    const h = setTimeout(() => lookup(idInput), 350)
    return () => clearTimeout(h)
  }, [idInput]) // eslint-disable-line
  const clearOperator = () => { setIdInput(''); setOperator(null); setLookupErr('') }

  // ---- core submit: takes the part/operator explicitly so it can be called
  //      straight from a scan without waiting for React state to settle ----
  const submitDraw = async (thePart, theOperator) => {
    if (!thePart || !theOperator) return false
    if (submittingRef.current) return false          // ignore a duplicated Enter
    submittingRef.current = true
    setBusy(true)

    // (1) reason is OPTIONAL — send null when it's blank
    const cleanReason = reason.trim() ? reason.trim() : null

    const { error } = await client.rpc('draw_part', {
      p_part_id: thePart.id,
      p_reason: cleanReason,
      p_operator_name: theOperator.name_en,
      p_operator_id: theOperator.employee_id,
      p_authorized_by: user?.id ?? null,
      p_qty: 1,
    })

    setBusy(false)
    submittingRef.current = false

    if (error) {
      alert(error.message.includes('INSUFFICIENT_STOCK') ? t.drawError : error.message)
      return false
    }

    setFlash(`${thePart.id} → ${theOperator.name_en}`)
    setTimeout(() => setFlash(''), 2500)

    // reset the form for the next scan cycle
    setReason(''); clearPart(); clearOperator()
    await refresh()
    return true
  }

  // manual click on "Authorize Stock Distribution"
  const submit = async (e) => {
    e?.preventDefault?.()
    if (!part) { alert(t.scanPartFirst || 'Please scan or enter a valid part ID first.'); return }
    if (!operator) { alert(t.scanOperatorFirst || 'Please scan or enter the operator / mechanic ID first.'); return }
    const ok = await submitDraw(part, operator)
    if (ok) partInputRef.current?.focus()
  }

  // ---- scan handlers ----
  // PART: Enter -> look up -> move to the badge field
  const handlePartKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const hit = findPart(partInput)
    if (hit) {
      operatorInputRef.current?.focus()
      operatorInputRef.current?.select()
    } else {
      partInputRef.current?.select()
    }
  }

  // (2)+(3) OPERATOR: Enter -> look up -> SUBMIT the draw -> focus back on the
  // part field. It never jumps to the reason box, so scanning is uninterrupted.
  const handleOperatorKeyDown = async (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const id = idInput.trim()
    if (!id) return

    const found = await lookup(id)
    if (!found) { operatorInputRef.current?.select(); return }

    const thePart = part || matchPart(partInput)
    if (!thePart) {
      // badge scanned before a valid part — send them back to scan the part
      setPartErr(t.scanPartFirst || 'Please scan or enter a valid part ID first.')
      partInputRef.current?.focus()
      return
    }

    await submitDraw(thePart, found)   // auto-submit BEFORE resetting focus
    partInputRef.current?.focus()      // ready for the next item immediately
  }

  return (
    <div className="two-col">
      <div className="card">
        <div className="card-h"><Edit3 size={14} /> {t.drawTitle}</div>
        {flash && <div className="success-banner">✓ {flash}</div>}
        <form onSubmit={submit}>

          {/* PART — scan / type the ID */}
          <label className="fl">{t.drawSelect}
            <div className="scan-row">
              <ScanLine size={16} className="scan-ic" />
              <input
                ref={partInputRef}
                type="text"
                value={partInput}
                onChange={(e) => setPartInput(e.target.value)}
                onKeyDown={handlePartKeyDown}
                placeholder={t.scanPartPlaceholder || 'Scan or type part ID (e.g. BC-8700)…'}
                autoComplete="off"
                autoFocus
              />
              {partInput && (
                <button type="button" className="scan-clear" onClick={clearPart} aria-label="Clear"><X size={14} /></button>
              )}
            </div>
          </label>
          {part && (
            <div className="identity-field" style={{ margin: '-8px 0 14px' }}>
              <Package size={16} />
              <div>
                <div><strong>{part.name}</strong>{part.model ? ` · ${part.model}` : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 500, textTransform: 'none' }}>
                  #{part.id} · {t.currentStock}: <strong style={{ color: part.stock <= part.min_stock ? 'var(--bad)' : 'var(--ok)' }}>{part.stock}</strong>
                  {part.bin ? ` · ${t.bin} ${part.bin}` : ''}
                </div>
              </div>
            </div>
          )}
          {partErr && !part && (
            <div className="login-err" style={{ margin: '-8px 0 14px' }}>{partErr}</div>
          )}

          {/* OPERATOR — scanning the badge submits the draw */}
          <label className="fl">{t.drawOperator || 'Operator / Mechanic'}
            <div className="scan-row">
              <ScanLine size={16} className="scan-ic" />
              <input
                ref={operatorInputRef}
                type="text"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                onKeyDown={handleOperatorKeyDown}
                placeholder={t.scanOperatorPlaceholder || 'Scan badge or type ID…'}
                autoComplete="off"
              />
              {idInput && (
                <button type="button" className="scan-clear" onClick={clearOperator} aria-label="Clear"><X size={14} /></button>
              )}
            </div>
          </label>
          {looking && (
            <div style={{ fontSize: 12, color: 'var(--ink2)', margin: '-8px 0 14px' }}>{t.loading || 'Looking up…'}</div>
          )}
          {operator && (
            <div className="identity-field" style={{ margin: '-8px 0 14px' }}>
              <UserCheck size={16} />
              <div>
                <div><strong>{operator.name_en}</strong>{operator.name_kh ? ` · ${operator.name_kh}` : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 500, textTransform: 'none' }}>
                  #{operator.employee_id} · {operator.position}{operator.department ? ` · ${operator.department}` : ''}
                </div>
              </div>
            </div>
          )}
          {lookupErr && !operator && !looking && (
            <div className="login-err" style={{ margin: '-8px 0 14px' }}>{lookupErr}</div>
          )}

          {/* (1) REASON — optional, and never grabs focus during scanning */}
          <label className="fl">
            {t.drawReason} <span className="opt-tag">({t.optional || 'optional'})</span>
            <textarea
              rows="3"
              placeholder={t.drawReasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              tabIndex={-1}
            />
          </label>

          <button type="submit" className="btn-primary" disabled={busy || !part || !operator}>
            <CheckCircle size={14} /> {busy ? t.saving : t.drawSubmitBtn}
          </button>
        </form>
      </div>

      <div className="col">
        {/* Header: title + export. Export is disabled when the visible set is
            empty so users don't produce an empty file. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="col-h" style={{ marginBottom: 0 }}>
            {t.historyTitle}
            {hasFilter && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink2)', fontWeight: 500, textTransform: 'none' }}>
                ({visibleDraws.length}/{draws.length})
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn-sec"
            onClick={exportDraws}
            disabled={visibleDraws.length === 0}
            title={t.exportDraws}
          >
            <Download size={14} /> {t.exportDraws}
          </button>
        </div>

        {/* Filter row — search + date range. All three feed `visibleDraws`,
            which is what the list renders AND what the export writes. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div className="scan-row" style={{ flex: '1 1 220px', minWidth: 180 }}>
            <Search size={14} className="scan-ic" />
            <input
              type="text"
              value={drawSearch}
              onChange={(e) => setDrawSearch(e.target.value)}
              placeholder={t.filterDrawsPlaceholder}
              autoComplete="off"
            />
            {drawSearch && (
              <button type="button" className="scan-clear" onClick={() => setDrawSearch('')} aria-label="Clear">
                <X size={14} />
              </button>
            )}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink2)', fontWeight: 600, textTransform: 'uppercase' }}>
            {t.dateFromLabel}
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '5px 7px', fontSize: 12, color: 'var(--ink)' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink2)', fontWeight: 600, textTransform: 'uppercase' }}>
            {t.dateToLabel}
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '5px 7px', fontSize: 12, color: 'var(--ink)' }}
            />
          </label>
          {hasFilter && (
            <button type="button" className="btn-sec" onClick={clearFilters}>
              <X size={13} /> {t.clearFilter}
            </button>
          )}
        </div>

        {/* Empty states: distinguish "nothing yet" from "nothing matches" so
            the operator knows whether to clear the filter or draw something. */}
        {draws.length === 0 ? (
          <div style={{ color: 'gray', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>{t.historyEmpty}</div>
        ) : visibleDraws.length === 0 ? (
          <div style={{ color: 'gray', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>{t.noDrawsMatch}</div>
        ) : visibleDraws.map((r) => (
          <div key={r.id} className="rcard">
            <div className="rcard-name">{t.distributedPart}: <span className="mono">{r.part_id}</span></div>
            {r.reason ? <div className="rcard-reason">{t.reasonLabel}: "{r.reason}"</div> : null}
            <div style={{ fontSize: 11, color: 'var(--ink2)' }}>
              {t.authorizedTo}: <strong>{r.mechanic || '—'}</strong>
              {r.operator_id && <span className="mono" style={{ marginLeft: 6, opacity: 0.7 }}>#{r.operator_id}</span>}
              {' | '}{new Date(r.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
