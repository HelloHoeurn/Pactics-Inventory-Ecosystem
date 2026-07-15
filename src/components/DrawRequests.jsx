import { useState } from 'react'
import { Edit3, CheckCircle } from 'lucide-react'
import { client } from '../neonClient'

export default function DrawRequests({ t, parts, draws, refresh }) {
  const [partId, setPartId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!partId || !reason) return
    setBusy(true)
    const { error } = await client.rpc('draw_part', {
      p_part_id: partId,
      p_reason: reason,
      p_mechanic: t.shiftTech,
      p_qty: 1,
    })
    setBusy(false)
    if (error) {
      // surface the friendly stock message for the known case
      alert(error.message.includes('INSUFFICIENT_STOCK') ? t.drawError : error.message)
      return
    }
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
            <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{t.authorizedTo}: <strong>{r.mechanic}</strong> | {new Date(r.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
