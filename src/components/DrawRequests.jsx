import { useState, useEffect } from 'react'
import { Edit3, CheckCircle, UserCheck, ScanLine, X } from 'lucide-react'
import { client } from '../neonClient'

export default function DrawRequests({ t, parts, draws, refresh }) {
  const [partId, setPartId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // logged-in user (records who AUTHORIZED the draw)
  const [user, setUser] = useState(null)
  useEffect(() => {
    client.auth.getSession()
      .then(({ data }) => setUser(data?.user ?? data?.session?.user ?? null))
      .catch((e) => console.error('Could not read current user:', e))
  }, [])

  // ---- operator/mechanic scan + lookup ----
  const [idInput, setIdInput] = useState('')
  const [operator, setOperator] = useState(null) // the looked-up employee
  const [looking, setLooking] = useState(false)
  const [lookupErr, setLookupErr] = useState('')

  const lookup = async (raw) => {
    const id = String(raw ?? idInput).trim()
    if (!id) return
    setLooking(true); setLookupErr(''); setOperator(null)
    const { data, error } = await client
      .from('employees')
      .select('employee_id,name_en,name_kh,position,department')
      .eq('employee_id', id)
      .limit(1)
    setLooking(false)
    if (error) { setLookupErr(error.message); return }
    if (!data || data.length === 0) {
      setLookupErr((t.operatorNotFound || 'No operator found for ID') + ` "${id}".`)
      return
    }
    setOperator(data[0])
  }

  // auto-look-up shortly after a scan/typing stops (a scanner types fast, then Enter)
  useEffect(() => {
    if (!idInput.trim()) { setOperator(null); setLookupErr(''); return }
    const h = setTimeout(() => lookup(idInput), 350)
    return () => clearTimeout(h)
  }, [idInput]) // eslint-disable-line

  const clearOperator = () => { setIdInput(''); setOperator(null); setLookupErr('') }

  const submit = async (e) => {
    e.preventDefault()
    if (!partId || !reason) return
    if (!operator) { alert(t.scanOperatorFirst || 'Please scan or enter the operator / mechanic ID first.'); return }
    setBusy(true)
    const { error } = await client.rpc('draw_part', {
      p_part_id: partId,
      p_reason: reason,
      p_operator_name: operator.name_en,     // scanned operator name  -> mechanic
      p_operator_id: operator.employee_id,   // scanned Employee ID     -> operator_id
      p_authorized_by: user?.id ?? null,     // signed-in user          -> authorized_by
      p_qty: 1,
    })
    setBusy(false)
    if (error) { alert(error.message.includes('INSUFFICIENT_STOCK') ? t.drawError : error.message); return }
    setReason(''); clearOperator()
    await refresh()
  }

  return (
    <div className="two-col">
      <div className="card">
        <div className="card-h"><Edit3 size={14} /> {t.drawTitle}</div>
        <form onSubmit={submit}>
          <label className="fl">{t.drawSelect}
            <select value={partId} onChange={(e) => setPartId(e.target.value)}>
              <option value="">{t.drawSelectPlaceholder}</option>
              {parts.map((p) => <option key={p.id} value={p.id}>{p.id} - {p.name} ({t.currentStock}: {p.stock})</option>)}
            </select>
          </label>

          {/* scan the badge / type the ID */}
          <label className="fl">{t.drawOperator || 'Operator / Mechanic'}
            <div className="scan-row">
              <ScanLine size={16} className="scan-ic" />
              <input
                type="text"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(idInput) } }}
                placeholder={t.scanOperatorPlaceholder || 'Scan badge or type ID…'}
                autoComplete="off"
                autoFocus
              />
              {idInput && (
                <button type="button" className="scan-clear" onClick={clearOperator} aria-label="Clear">
                  <X size={14} />
                </button>
              )}
            </div>
          </label>

          {/* live lookup result — read-only confirmation */}
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

          <label className="fl">{t.drawReason}
            <textarea rows="4" placeholder={t.drawReasonPlaceholder} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>

          <button type="submit" className="btn-primary" disabled={busy || !operator}>
            <CheckCircle size={14} /> {busy ? t.saving : t.drawSubmitBtn}
          </button>
        </form>
      </div>

      <div className="col">
        <div className="col-h">{t.historyTitle}</div>
        {draws.length === 0 ? (
          <div style={{ color: 'gray', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>{t.historyEmpty}</div>
        ) : draws.map((r) => (
          <div key={r.id} className="rcard">
            <div className="rcard-name">{t.distributedPart}: <span className="mono">{r.part_id}</span></div>
            <div className="rcard-reason">{t.reasonLabel}: "{r.reason}"</div>
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
