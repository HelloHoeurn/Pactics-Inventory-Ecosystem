// CSV export helper.
// - UTF-8 BOM (﻿) so Excel opens the file with Khmer intact.
// - CRLF line endings per RFC 4180 (safest across Excel / Sheets / Numbers).
// - RFC 4180 quoting: any field containing ", comma, CR or LF is wrapped in
//   quotes, and inner quotes are doubled.
// - Formula-injection guard: a leading = + - @ TAB or CR in a string value is
//   prefixed with a single quote so Excel won't evaluate it as a formula.
//   Real hazard here because we export user-typed fields (e.g. draw reasons).
//
// Column spec: { key, label, format?(value, row) }
//   `format` is optional. When omitted, row[key] is used as-is.
//   Existing call-sites that pass only {key,label} keep working unchanged.

const FORMULA_LEAD = /^[=+\-@\t\r]/

const stringify = (v) => {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

const esc = (raw) => {
  let s = stringify(raw)
  if (s && FORMULA_LEAD.test(s)) s = "'" + s
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function exportCSV(filename, columns, data) {
  const head = columns.map((c) => esc(c.label)).join(',')
  const body = data
    .map((r) => columns.map((c) => esc(c.format ? c.format(r[c.key], r) : r[c.key])).join(','))
    .join('\r\n')
  const csv = '﻿' + head + '\r\n' + body + (body ? '\r\n' : '')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)   // Firefox requires the link to be in the DOM
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
