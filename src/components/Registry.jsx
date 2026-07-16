import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Factory, Boxes, MapPin, AlertTriangle, Download, QrCode, Printer, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { client } from '../neonClient'
import { exportCSV } from '../lib/csv'

export default function Registry({ t, machines, parts, filter, setFilter, refresh }) {
  const [mode, setMode] = useState('parts')
  const [selected, setSelected] = useState(null)
  const [adj, setAdj] = useState('')
  const [busy, setBusy] = useState(false)

  // (1) multi-select for QR printing — id -> {id,name,model}. Persists across
  // the Machines/Parts toggle so you can print a mixed batch.
  const [checked, setChecked] = useState({})
  const checkedList = Object.values(checked)

  const toggleCheck = (item) =>
    setChecked((prev) => {
      const next = { ...prev }
      if (next[item.id]) delete next[item.id]
      else next[item.id] = { id: item.id, name: item.name, model: item.model }
      return next
    })
  const clearChecked = () => setChecked({})
  const printLabels = () => window.print()

  useEffect(() => {
    if (!filter) return
    const m = machines.find((x) => x.id.toLowerCase() === filter.toLowerCase())
    const p = parts.find((x) => x.id.toLowerCase() === filter.toLowerCase())
    if (m) { setMode('machines'); setSelected(m) }
    else if (p) { setMode('parts'); setSelected(p) }
  }, [filter, machines, parts])

  useEffect(() => {
    if (!selected) return
    const pool = mode === 'machines' ? machines : parts
    const fresh = pool.find((x) => x.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [machines, parts]) // eslint-disable-line

  const items = useMemo(() => {
    const pool = mode === 'machines' ? machines : parts
    const f = filter.toLowerCase()
    return pool.filter((x) => !f || x.id.toLowerCase().includes(f) || x.name.toLowerCase().includes(f))
  }, [mode, machines, parts, filter])

  const allVisibleChecked = items.length > 0 && items.every((x) => checked[x.id])
  const toggleAllVisible = () =>
    setChecked((prev) => {
      const next = { ...prev }
      if (allVisibleChecked) items.forEach((x) => delete next[x.id])
      else items.forEach((x) => { next[x.id] = { id: x.id, name: x.name, model: x.model } })
      return next
    })

  const adjustStock = async () => {
    const amt = parseInt(adj)
    if (isNaN(amt) || !selected) return
    setBusy(true)
    const { error } = await client.rpc('adjust_stock', { p_part_id: selected.id, p_delta: amt })
    setBusy(false)
    setAdj('')
    if (error) { alert(error.message); return }
    await refresh()
  }

  const exportView = () => {
    if (mode === 'machines') {
      exportCSV('machines.csv', [
        { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'type', label: 'Type' },
        { key: 'model', label: 'Model' }, { key: 'location', label: 'Location' }, { key: 'status', label: 'Status' },
      ], items)
    } else {
      exportCSV('spare_parts.csv', [
        { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'type', label: 'Type' },
        { key: 'model', label: 'Model' }, { key: 'stock', label: 'Stock' }, { key: 'min_stock', label: 'GuardLevel' }, { key: 'bin', label: 'Bin' },
      ], items)
    }
  }

  return (
    <>
      <div className="subbar">
        <div className="seg-toggle">
          <button className={`seg-t ${mode === 'machines' ? 'on' : ''}`} onClick={() => { setMode('machines'); setSelected(null) }}><Factory size={13} /> {t.machines}</button>
          <button className={`seg-t ${mode === 'parts' ? 'on' : ''}`} onClick={() => { setMode('parts'); setSelected(null) }}><Boxes size={13} /> {t.spareParts}</button>
        </div>
        <div className="reg-search">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.filterPlaceholder} />
        </div>
        {filter && <button className="btn-sec" onClick={() => { setFilter(''); setSelected(null) }}>{t.clearFilter}</button>}
        <button className="btn-sec" onClick={exportView} disabled={items.length === 0}><Download size={14} /> {t.exportView}</button>
        <label className="btn-sec" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={allVisibleChecked} onChange={toggleAllVisible} style={{ marginRight: 6 }} />
          {t.selectAll || 'Select all'}
        </label>
      </div>

      {/* (2) print action bar — only when something is selected */}
      {checkedList.length > 0 && (
        <div className="print-bar">
          <span><strong>{checkedList.length}</strong> {t.selectedCount || 'selected'}</span>
          <button className="btn-primary" onClick={printLabels}><Printer size={14} /> {t.printQr || 'Print Selected QR Codes'}</button>
          <button className="btn-sec" onClick={clearChecked}><X size={13} /> {t.clearSel || 'Clear'}</button>
        </div>
      )}

      <div className="split">
        <div className="list">
          {items.map((x) => (
            <div key={x.id} className={`row-wrap ${checked[x.id] ? 'checked' : ''}`}>
              <input
                type="checkbox"
                className="row-check"
                checked={!!checked[x.id]}
                onChange={() => toggleCheck(x)}
                aria-label={`Select ${x.id}`}
              />
              <button className={`row ${selected?.id === x.id ? 'sel' : ''}`} onClick={() => setSelected(x)}>
                <div className="row-main">
                  <span className="mono tag">{x.id}</span>
                  <span className="row-name">{x.name}</span>
                </div>
                <div style={{ fontSize: 11, color: 'gray' }}>{t.modelId}: {x.model}</div>
                {x.stock !== undefined && x.stock !== null && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600, background: x.stock <= x.min_stock ? '#fbe9e7' : '#e3f2ea', color: x.stock <= x.min_stock ? '#c0392b' : '#1f7a4d' }}>
                      {t.levelStockUnits.replace('{qty}', x.stock)}
                    </span>
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="detail">
          {selected ? (
            <div className="dpanel">
              <div className="phead">
                <p className="phead-sub">{t.systemId}: <strong className="mono">{selected.id}</strong></p>
                <h2 className="phead-title">{selected.name}</h2>
              </div>
              <div className="dgrid">
                <div><div className="field-l">{t.catClassification}</div><div className="field-v">{selected.type}</div></div>
                <div><div className="field-l">{t.modelId}</div><div className="field-v">{selected.model}</div></div>
                {selected.location && <div><div className="field-l">{t.assignedLine}</div><div className="field-v">{selected.location}</div></div>}
                {selected.bin && <div><div className="field-l">{t.shelfLocation}</div><div className="field-v" style={{ color: 'blue' }}><MapPin size={12} /> {selected.bin}</div></div>}
              </div>

              {selected.stock !== undefined && selected.stock !== null && (
                <div className="stock-action-box">
                  <div className="field-l">{t.maintenanceBox}</div>
                  <div>{t.currentStock}: <strong>{selected.stock}</strong> ({t.guardLevel}: {selected.min_stock})</div>
                  {selected.stock <= selected.min_stock && (
                    <div className="alert-banner" style={{ marginTop: 10 }}><AlertTriangle size={14} /> {t.stockBreachAlert}</div>
                  )}
                  <div className="stock-inline-form">
                    <input type="number" placeholder={t.qtyPlaceholder} value={adj} onChange={(e) => setAdj(e.target.value)} style={{ padding: 8, fontSize: 13, border: '1px solid var(--line)', borderRadius: 6, width: 180 }} />
                    <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 12.5 }} onClick={adjustStock} disabled={busy}>{busy ? t.saving : t.updateBtn}</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="detail-empty">
              <QrCode size={24} />
              <p>{t.registryEmpty}</p>
            </div>
          )}
        </div>
      </div>

      {/* (3)+(4) print-only label sheet, portaled to <body> so hiding the app
          (#root) in print doesn't hide it. Uses qrcode.react for real QR codes. */}
      {createPortal(
        <div className="print-area">
          {checkedList.map((it) => (
            <div className="label-card" key={it.id}>
              <QRCodeSVG value={String(it.id)} size={128} level="M" />
              <div className="label-id">{it.id}</div>
              <div className="label-name">{it.name}</div>
              <div className="label-model">{t.modelId}: {it.model || '—'}</div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
