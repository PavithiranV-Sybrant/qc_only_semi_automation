import { useState, useEffect, useRef } from 'react'
import { listTemplates, saveTemplate, deleteTemplate, uploadFile, getConfig } from '../api'

const COLUMN_ROLES = [
  // ── Name ──────────────────────────────────────────────
  { key: 'full_name',            label: 'Full Name' },
  { key: 'first_name',           label: 'First Name' },
  { key: 'middle_name',          label: 'Middle Name' },
  { key: 'last_name',            label: 'Last Name' },
  // ── Company / Contact ─────────────────────────────────
  { key: 'company',              label: 'Company' },
  { key: 'email',                label: 'Email' },
  { key: 'office_state',         label: 'Office State' },
  { key: 'office_city',          label: 'Office City' },
  { key: 'postal_code',          label: 'Office Postal Code' },
  { key: 'employee_count',       label: 'Employee Count' },
  { key: 'company_revenue',      label: 'Company Revenue' },
  // ── Industry / Title ──────────────────────────────────
  { key: 'linkedin',             label: 'LinkedIn' },
  { key: 'primary_industry',     label: 'Primary Industry' },
  { key: 'job_title',            label: 'Job Title' },
  { key: 'sic_code',             label: 'SIC Code' },
  // ── Link Text & Description ───────────────────────────
  { key: 'link_text',            label: 'Link Text' },
  { key: 'description',          label: 'Description' },
  // ── Facebook ──────────────────────────────────────────
  { key: 'facebook',             label: 'Facebook URL' },
  { key: 'facebook_link_text',   label: 'Facebook Link Text 1' },
  { key: 'facebook_description', label: 'Facebook Description 1' },
  // ── Identity ──────────────────────────────────────────
  { key: 'unique_identifier',    label: 'Unique Identifier' },
]

const EMPTY_FORM = {
  name:          '',
  comment:       '',
  sheet_name:    '',
  phone_columns: '',
  columns:       Object.fromEntries(COLUMN_ROLES.map(r => [r.key, ''])),
}

/** Score templates against actual column names, return pre-filled form fields. */
function autoFillFromColumns(columns, cfg) {
  const colSet = new Set(columns)
  let bestMap = cfg.columns || {}
  let bestScore = -1

  for (const colMap of Object.values(cfg.templates || {})) {
    let score = 0
    for (const expected of Object.values(colMap)) {
      if (Array.isArray(expected)) {
        if (expected.some(e => colSet.has(e))) score++
      } else if (expected && colSet.has(expected)) score++
    }
    if (score > bestScore) { bestScore = score; bestMap = colMap }
  }

  const newCols = {}
  for (const { key } of COLUMN_ROLES) {
    const expected = bestMap[key]
    newCols[key] = (expected && colSet.has(expected)) ? expected : ''
  }
  const phone = Array.isArray(bestMap.phone_columns)
    ? bestMap.phone_columns.filter(c => colSet.has(c)).join(', ')
    : ''
  return { columns: newCols, phone_columns: phone }
}

function templateToForm(t) {
  return {
    name:          t.name,
    comment:       t.comment || '',
    sheet_name:    t.sheet_name || '',
    phone_columns: Array.isArray(t.columns.phone_columns)
      ? t.columns.phone_columns.join(', ')
      : (t.columns.phone_columns || ''),
    columns:       Object.fromEntries(
      COLUMN_ROLES.map(r => [r.key, t.columns[r.key] || ''])
    ),
  }
}

// ─── Column field: dropdown (when columns available) or plain text input ──

const MANUAL_SENTINEL = '__manual__'

function ColumnField({ value, onChange, uploadedColumns, placeholder }) {
  // true when user has chosen "Type manually" or value isn't in the list
  const [manual, setManual] = useState(false)

  // Sync manual state whenever value or list changes
  useEffect(() => {
    if (!uploadedColumns.length) { setManual(false); return }
    if (value === '') { setManual(false); return }
    setManual(!uploadedColumns.includes(value))
  }, [value, uploadedColumns])

  // No file uploaded → plain text input
  if (!uploadedColumns.length) {
    return (
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2
          outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
      />
    )
  }

  // File uploaded + manual mode → text input with a "← list" button
  if (manual) {
    return (
      <div className="mt-1 flex gap-1">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Type column name…"
          autoFocus
          className="flex-1 text-sm border border-violet-300 rounded-lg px-3 py-2
            outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
        />
        <button
          type="button"
          onClick={() => { setManual(false); onChange('') }}
          title="Back to list"
          className="shrink-0 px-2.5 text-xs text-gray-400 hover:text-violet-600
            border border-gray-200 hover:border-violet-300 rounded-lg transition-colors"
        >
          ↩
        </button>
      </div>
    )
  }

  // File uploaded → dropdown
  return (
    <select
      value={value}
      onChange={e => {
        if (e.target.value === MANUAL_SENTINEL) {
          setManual(true)
          onChange('')
        } else {
          onChange(e.target.value)
        }
      }}
      className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2
        bg-white outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
    >
      <option value="">(not mapped)</option>
      {uploadedColumns.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
      <option value={MANUAL_SENTINEL}>— Type manually —</option>
    </select>
  )
}

// ─── File drop zone ────────────────────────────────────────────────────────

function FileDropZone({ onColumns }) {
  const [dragging,   setDragging]   = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [loadedFile, setLoadedFile] = useState(null)
  const inputRef = useRef(null)

  async function processFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'csv'].includes(ext)) return
    setUploading(true)
    setLoadedFile(null)
    try {
      const result = await uploadFile(file)
      setLoadedFile(file.name)
      onColumns(result.column_names || [])
    } catch {
      onColumns([])
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files?.[0])
  }

  function onInputChange(e) {
    processFile(e.target.files?.[0])
    e.target.value = ''
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors
        ${dragging   ? 'border-violet-400 bg-violet-50'
        : uploading  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
        : loadedFile ? 'border-green-300 bg-green-50'
        : 'border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50'}`}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.csv" onChange={onInputChange} className="hidden" />

      {uploading ? (
        <>
          <svg className="w-5 h-5 text-violet-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm text-violet-600">Reading columns…</span>
        </>
      ) : loadedFile ? (
        <>
          <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm text-green-700 font-medium truncate">{loadedFile}</p>
            <p className="text-xs text-green-500">Column dropdowns enabled. Click to load a different file.</p>
          </div>
        </>
      ) : (
        <>
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div>
            <p className="text-sm text-gray-600 font-medium">Drop a file here or click to browse</p>
            <p className="text-xs text-gray-400">.xlsx or .csv — column dropdowns activate instantly</p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function TemplateManager({ onBack }) {
  const [templates,        setTemplates]        = useState([])
  const [selected,         setSelected]         = useState(null)
  const [isNew,            setIsNew]            = useState(false)
  const [form,             setForm]             = useState(EMPTY_FORM)
  const [saving,           setSaving]           = useState(false)
  const [deleting,         setDeleting]         = useState(false)
  const [msg,              setMsg]              = useState(null)
  const [confirmDel,       setConfirmDel]       = useState(false)
  const [uploadedColumns,  setUploadedColumns]  = useState([])   // columns from dropped file

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await listTemplates()
      setTemplates(data)
    } catch {
      setMsg({ type: 'err', text: 'Failed to load templates.' })
    }
  }

  function selectTemplate(t) {
    setSelected(t.name)
    setIsNew(false)
    setForm(templateToForm(t))
    setMsg(null)
    setConfirmDel(false)
    setUploadedColumns([])
  }

  function startNew() {
    setSelected(null)
    setIsNew(true)
    setForm(EMPTY_FORM)
    setMsg(null)
    setConfirmDel(false)
    setUploadedColumns([])
  }

  async function handleFileColumns(columnNames) {
    setUploadedColumns(columnNames)
    if (!columnNames.length) {
      setMsg({ type: 'err', text: 'Could not read columns from file.' })
      return
    }
    try {
      const cfg = await getConfig()
      const { columns, phone_columns } = autoFillFromColumns(columnNames, cfg)
      setForm(f => ({ ...f, columns, phone_columns }))
      setMsg({ type: 'ok', text: 'Mappings auto-filled — adjust if needed.' })
    } catch {
      setMsg({ type: 'err', text: 'Failed to auto-detect mappings.' })
    }
  }

  function setCol(key, val) {
    setForm(f => ({ ...f, columns: { ...f.columns, [key]: val } }))
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) return setMsg({ type: 'err', text: 'Template name is required.' })

    const phoneArr = form.phone_columns
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const payload = {
      comment:    form.comment.trim(),
      sheet_name: form.sheet_name.trim() || null,
      columns:    { ...form.columns, phone_columns: phoneArr },
    }

    setSaving(true)
    setMsg(null)
    try {
      await saveTemplate(name, payload)
      await load()
      setIsNew(false)
      setSelected(name)
      setMsg({ type: 'ok', text: 'Template saved.' })
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    setDeleting(true)
    try {
      await deleteTemplate(selected)
      await load()
      setSelected(null)
      setIsNew(false)
      setForm(EMPTY_FORM)
      setMsg({ type: 'ok', text: 'Template deleted.' })
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || 'Delete failed.' })
    } finally {
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  const hasForm = isNew || selected !== null

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Left panel — template list */}
      <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-2">
          <button onClick={onBack}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-violet-600 transition-colors"
            title="Back to home">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-violet-700">Template Manager</h1>
        </div>

        <div className="p-3">
          <button onClick={startNew}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2 rounded-lg
              transition-colors flex items-center justify-center gap-1.5">
            <span className="text-lg leading-none">+</span> New Template
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {templates.length === 0 && (
            <p className="text-xs text-gray-400 px-1 pt-2">No templates yet. Click "New Template" to create one.</p>
          )}
          {templates.map(t => (
            <button key={t.name} onClick={() => selectTemplate(t)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors
                ${selected === t.name && !isNew
                  ? 'bg-violet-50 border border-violet-300 text-violet-700'
                  : 'hover:bg-gray-50 border border-transparent text-gray-700'}`}>
              <p className="font-semibold truncate">{t.name}</p>
              {t.comment && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{t.comment}</p>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Right panel — form */}
      <main className="flex-1 overflow-y-auto">
        {!hasForm ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="text-5xl mb-4">🗂️</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Select or create a template</h2>
            <p className="text-gray-400 text-sm max-w-sm">
              Templates define how column roles map to your data source's actual column headers.
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                {isNew ? 'New Template' : `Edit: ${selected}`}
              </h2>
              {msg && (
                <span className={`text-xs px-3 py-1 rounded-full font-medium
                  ${msg.type === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {msg.text}
                </span>
              )}
            </div>

            {/* File upload — only when creating new */}
            {isNew && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Load columns from file
                  <span className="normal-case font-normal text-gray-400 ml-1">(optional — enables dropdowns)</span>
                </p>
                <FileDropZone onColumns={handleFileColumns} />
              </div>
            )}

            {/* Metadata */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Metadata</p>

              <label className="block">
                <span className="text-xs text-gray-600 font-medium">
                  Template Name <span className="text-red-400">*</span>
                </span>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  readOnly={!isNew}
                  placeholder="e.g. manta_database"
                  className={`mt-1 block w-full text-sm border rounded-lg px-3 py-2 outline-none
                    focus:ring-2 focus:ring-violet-400 focus:border-violet-400
                    ${!isNew ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-300'}`}
                />
                {isNew && <p className="text-xs text-gray-400 mt-0.5">Letters, numbers, underscores, hyphens only.</p>}
              </label>

              <label className="block">
                <span className="text-xs text-gray-600 font-medium">Description</span>
                <input
                  value={form.comment}
                  onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Short description of this template"
                  className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2
                    outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-600 font-medium">
                  Sheet Name <span className="text-gray-400 font-normal">(optional — leave blank for auto)</span>
                </span>
                <input
                  value={form.sheet_name}
                  onChange={e => setForm(f => ({ ...f, sheet_name: e.target.value }))}
                  placeholder="Leave blank to use the first sheet"
                  className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2
                    outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                />
              </label>
            </div>

            {/* Column mappings */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Column Mappings</p>
                {uploadedColumns.length > 0 && (
                  <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-medium">
                    {uploadedColumns.length} columns loaded
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {uploadedColumns.length > 0
                  ? 'Select from the file\'s columns, or choose "— Type manually —" at the bottom of any dropdown.'
                  : 'Enter the exact column header as it appears in your Excel/CSV file.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {COLUMN_ROLES.map(r => (
                  <div key={r.key}>
                    <span className="text-xs text-gray-600 font-medium">{r.label}</span>
                    <ColumnField
                      value={form.columns[r.key]}
                      onChange={val => setCol(r.key, val)}
                      uploadedColumns={uploadedColumns}
                      placeholder={`Column header for ${r.label}`}
                    />
                  </div>
                ))}
              </div>

              {/* Phone columns */}
              <div>
                <span className="text-xs text-gray-600 font-medium">Phone Columns</span>
                <span className="text-xs text-gray-400 ml-1">(comma-separated)</span>
                <input
                  value={form.phone_columns}
                  onChange={e => setForm(f => ({ ...f, phone_columns: e.target.value }))}
                  placeholder="e.g. BusinessPhone, MobilePhone, OfficePhone"
                  className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2
                    outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pb-8">
              <button onClick={handleSave} disabled={saving}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white font-semibold
                  px-6 py-2.5 rounded-lg transition-colors text-sm">
                {saving ? 'Saving…' : (isNew ? 'Create Template' : 'Save Changes')}
              </button>

              {!isNew && selected && (
                confirmDel ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Delete "{selected}"?</span>
                    <button onClick={handleDelete} disabled={deleting}
                      className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors">
                      {deleting ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button onClick={() => setConfirmDel(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDel(true)}
                    className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors px-2">
                    Delete
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
