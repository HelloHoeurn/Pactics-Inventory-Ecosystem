import { useState } from 'react'
import { Save } from 'lucide-react'
import { client } from '../neonClient'

export default function AddItem({ t, setView, refresh }) {
  const [formType, setFormType] = useState('machine')
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [model, setModel] = useState('')
  const [extra, setExtra] = useState('')
  const [initialStock, setInitialStock] = useState('10')
  const [minStock, setMinStock] = useState('5')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!id || !name) { setMsg(t.formErr); return }
    setBusy(true)
    let error
    if (formType === 'machine') {
      ({ error } = await client.from('machines').insert({
        id, name, type: 'Machine', model, location: extra || 'Unassigned', status: 'Active',
      }))
    } else {
      ({ error } = await client.from('spare_parts').insert({
        id, name, type: 'Spare Part', model,
        stock: parseInt(initialStock) || 0, min_stock: parseInt(minStock) || 0, bin: extra || 'A-01-1',
      }))
    }
    setBusy(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg(t.formSuccess)
    await refresh()
    setTimeout(() => { setMsg(''); setView('dashboard') }, 1200)
  }

  const isErr = msg.startsWith('Error') || msg.includes('កំហុស')

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: 480 }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2>{t.formTitle}</h2>
        {msg && <div className={isErr ? 'alert-banner' : 'success-banner'}>{msg}</div>}

        <div className="seg-toggle" style={{ marginBottom: 20, width: 'fit-content' }}>
          <button type="button" className={`seg-t ${formType === 'machine' ? 'on' : ''}`} onClick={() => setFormType('machine')}>{t.formMachineTab}</button>
          <button type="button" className={`seg-t ${formType === 'part' ? 'on' : ''}`} onClick={() => setFormType('part')}>{t.formPartTab}</button>
        </div>

        <form onSubmit={handleCreate}>
          <label className="fl">{t.labelQr} <input type="text" placeholder={formType === 'machine' ? 'e.g. PAC-M-0099' : 'e.g. SG-8700-V'} value={id} onChange={(e) => setId(e.target.value)} /></label>
          <label className="fl">{t.labelName} <input type="text" placeholder={formType === 'machine' ? 'Juki Heavy Duty Bartack' : 'Tension Release Spring'} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="fl">{t.labelModel} <input type="text" placeholder="e.g. LK-1900 / Universal" value={model} onChange={(e) => setModel(e.target.value)} /></label>
          <label className="fl">{t.labelLineOrBin} <input type="text" placeholder={formType === 'machine' ? 'e.g. Line 5' : 'e.g. C-03-2'} value={extra} onChange={(e) => setExtra(e.target.value)} /></label>

          {formType === 'part' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <label className="fl" style={{ flex: 1 }}>{t.labelInitStock} <input type="number" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} /></label>
              <label className="fl" style={{ flex: 1 }}>{t.labelMinGuard} <input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} /></label>
            </div>
          )}
          <button type="submit" className="btn-primary" style={{ marginTop: 10 }} disabled={busy}><Save size={14} /> {busy ? t.saving : t.formSubmitBtn}</button>
        </form>
      </div>
    </div>
  )
}
