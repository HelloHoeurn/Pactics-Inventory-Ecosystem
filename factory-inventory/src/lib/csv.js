// CSV export. UTF-8 BOM (\uFEFF) keeps Khmer text readable in Excel.
export function exportCSV(filename, columns, data) {
  const esc = (v) => {
    v = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
  }
  const head = columns.map((c) => esc(c.label)).join(',')
  const body = data.map((r) => columns.map((c) => esc(r[c.key])).join(',')).join('\n')
  const csv = '\uFEFF' + head + '\n' + body
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
