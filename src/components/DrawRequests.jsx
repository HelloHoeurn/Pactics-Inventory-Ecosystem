import { useState, useEffect } from 'react'
import { Edit3, CheckCircle } from 'lucide-react'
import { client } from '../neonClient'

export default function DrawRequests({ t, parts, draws, refresh }) {
  const [partId, setPartId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const [user, setUser] = useState(null)          // signed-in Neon Auth user (authorizer)
  const [employees, setEmployees] = useState([])  // mechanics + operators roster
  const [empSearch, setEmpSearch] = useState('')
  const [operatorId, setOperatorId] = useState('')

  // who is signed in (authorizes the draw)
  useEffect(() => {
    client.auth.getSession()
      .then(({ data }) => setUser(data?.user ?? data?.session?.user ?? null))
      .catch((e) => console.error('Could not read current user:', e))
  }, [])

  // load the roster and keep only mechanics + operators
  useEffect(() => {
    client.from('employees')
      .select('employee_id,name_en,name_kh,position,department')
      .order('name_en')
      .then(({ data, error }) => {
        if (error) { console.error('Load employees failed:', error); return }
        setEmployees((data || []).filter((e) => /mechanic|operator/i.test(e.position || '')))
      })
  }, [])

  const q = empSearch.trim().toLowerCase()
  const filtered = q
    ? employees.filter((e) => [e.employee_id, e.name_en, e.name_kh, e.position]
        .some((v) => String(v || '').toLowerCase().includes(q)))
    : employees

  const submit = async (e) => {
    e.preventDefault()
    if (!partId || !reason) return
    const emp = employees.find((x) => x.employee_id === operatorId)
    if (!emp) { alert(t.drawPickOperator || 'Please select the operator / mechanic.'); return }
    setBusy(true)
    const { error } = await client.rpc('draw_part', {
      p_part_id: partId,
      p_reason: reason,
      p_operator_name: emp.name_en,       // -> mechanic (name)
      p_operator_id: emp.employee_id,     // -> operator_id
      p_authorized_by: user?.id ?? null,  // -> authorized_by (login user)
      p_qty: 1,
    })
    setBusy(false)
    if (error) { alert(error.message.includes('INSUFFICIENT_STOCK') ? t.drawError : error.message); return }
    setReason(''); setOperatorId(''); setEmpSearch('')
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

          {/* operator / mechanic — picked from the real employee roster */}
          <label className="fl">{t.drawOperator || 'Operator / Mechanic'}
            <input type="text" placeholder={t.drawOperatorSearch || 'Search name or ID…'}
              value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} style={{ marginBottom: 6 }} />
            <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
              <option value="">{t.drawOperatorPlaceholder || '-- choose person --'}</option>
              {filtered.slice(0, 200).map((e) => (
                <option key={e.employee_id} value={e.employee_id}>
                  {e.employee_id} — {e.name_en} · {e.position}
                </option>
              ))}
            </select>
            {filtered.length > 200 && (
              <small style={{ color: 'var(--ink2)' }}>{t.drawOperatorMore || 'Showing first 200 — type to narrow.'}</small>
            )}
          </label>

          <label className="fl">{t.drawReason}
            <textarea rows="4" placeholder={t.drawReasonPlaceholder} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}><CheckCircle size={14} /> {busy ? t.saving : t.drawSubmitBtn}</button>
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
            {/* who drew it: name + Employee ID */}
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
