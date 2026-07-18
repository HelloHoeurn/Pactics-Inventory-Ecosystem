import { useState, useEffect } from 'react'
import { Edit3, CheckCircle, UserCheck } from 'lucide-react'
import { client } from '../neonClient'

export default function DrawRequests({ t, parts, draws, refresh }) {
  const [partId, setPartId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // The authorizing person = the currently signed-in Neon Auth user.
  // No dropdown — we read it straight from the auth session.
  const [user, setUser] = useState(null)
  useEffect(() => {
    client.auth
      .getSession()
      .then(({ data }) => setUser(data?.user ?? data?.session?.user ?? null))
      .catch((e) => console.error('Could not read current user:', e))
  }, [])

  const displayName = user ? (user.name || user.email || user.id) : ''
  const identityText = user
    ? (user.name && user.email ? `${user.name} · ${user.email}` : (user.name || user.email || user.id))
    : ''

  const submit = async (e) => {
    e.preventDefault()
    if (!partId || !reason) return
    if (!user) { alert('Could not identify the signed-in user — please sign in again.'); return }
    setBusy(true)

    // send the logged-in user automatically with the part + reason
    const { error } = await client.rpc('draw_part', {
      p_part_id: partId,
      p_reason: reason,
      p_operator_name: displayName,  // -> mechanic (name)
      p_operator_id: user.id,        // -> operator_id (auth user id)
      p_authorized_by: user.id,      // -> authorized_by
      p_qty: 1,
    })

    setBusy(false)
    if (error) { alert(error.message.includes('INSUFFICIENT_STOCK') ? t.drawError : error.message); return }
    setReason('')
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

          {/* Read-only: whoever is logged in authorizes the draw — no selection needed */}
          <label className="fl">{t.drawOperator || 'Authorized by'}
            <div className="identity-field">
              <UserCheck size={15} />
              <span>{identityText || (t.loading || 'Loading…')}</span>
            </div>
          </label>

          <label className="fl">{t.drawReason}
            <textarea rows="4" placeholder={t.drawReasonPlaceholder} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>

          <button type="submit" className="btn-primary" disabled={busy || !user}>
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
              {' | '}{new Date(r.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
