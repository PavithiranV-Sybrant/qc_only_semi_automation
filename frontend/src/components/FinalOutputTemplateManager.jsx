import { useState, useEffect, useRef } from 'react'
import {
  ftExtractHeaders,
  ftListTemplates,
  ftSaveTemplate,
  ftDeleteTemplate,
  ftCheckFile,
  ftNormalizeDownload,
} from '../api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function argbToHex(argb) {
  if (!argb || argb.startsWith('theme:') || argb.startsWith('indexed:') || argb === '00000000') return null
  if (/^[0-9A-Fa-f]{8}$/.test(argb)) return '#' + argb.slice(2)
  return null
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
      title="Back"
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}

function FileDropZone({ onFile, file, accept = '.xlsx,.csv', label = 'Drop file here or click to browse' }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  function handleFile(f) {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    const accepted = accept.split(',').map(a => a.trim().replace('.', '').toLowerCase())
    if (!accepted.includes(ext)) {
      alert(`Only ${accept} files are supported.`)
      return
    }
    onFile(f)
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
        ${dragging ? 'border-violet-500 bg-violet-50' : 'border-gray-300 hover:border-violet-400'}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => handleFile(e.target.files[0])}
      />
      {file ? (
        <>
          <div className="text-2xl mb-1">📄</div>
          <p className="text-sm font-medium text-violet-700 truncate px-2">{file.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">Click to replace</p>
        </>
      ) : (
        <>
          <div className="text-2xl mb-1">📂</div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{accept}</p>
        </>
      )}
    </div>
  )
}

function ActionBadge({ action, confidence }) {
  const configs = {
    exact:         { cls: 'bg-green-100 text-green-700',   text: '✓ Exact' },
    reorder:       { cls: 'bg-amber-100 text-amber-700',   text: '⇅ Reorder' },
    auto_rename:   { cls: 'bg-blue-100 text-blue-700',     text: '✏ Auto-rename' },
    fuzzy_suggest: { cls: 'bg-orange-100 text-orange-700', text: `~ Fuzzy ${confidence != null ? `(${confidence}%)` : ''}` },
    missing:       { cls: 'bg-red-100 text-red-700',       text: '✗ Missing' },
  }
  const cfg = configs[action] || { cls: 'bg-gray-100 text-gray-500', text: action }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.cls}`}>
      {cfg.text}
    </span>
  )
}

// ── Create Template sub-view ──────────────────────────────────────────────────

function CreateTemplateView({ onBack }) {
  const [file,             setFile]             = useState(null)
  const [extracting,       setExtracting]       = useState(false)
  const [extractError,     setExtractError]     = useState(null)
  const [columns,          setColumns]          = useState([])
  const [templateName,     setTemplateName]     = useState('')
  const [saving,           setSaving]           = useState(false)
  const [msg,              setMsg]              = useState(null)
  const [savedTemplates,   setSavedTemplates]   = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [deletingName,     setDeletingName]     = useState(null)

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    setLoadingTemplates(true)
    try { setSavedTemplates(await ftListTemplates()) } catch { }
    setLoadingTemplates(false)
  }

  async function handleFile(f) {
    setFile(f)
    setExtractError(null)
    setColumns([])
    setMsg(null)
    setExtracting(true)
    try {
      const data = await ftExtractHeaders(f)
      setColumns(data.columns)
    } catch (e) {
      setExtractError(e.response?.data?.detail || 'Failed to read file headers.')
    }
    setExtracting(false)
  }

  async function handleSave() {
    const name = templateName.trim()
    if (!name || columns.length === 0) return
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setMsg({ type: 'err', text: 'Name can only contain letters, numbers, underscores, and hyphens.' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await ftSaveTemplate(name, { comment: '', columns })
      setMsg({ type: 'ok', text: `Template "${name}" saved!` })
      setTemplateName('')
      setColumns([])
      setFile(null)
      loadTemplates()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || 'Failed to save template.' })
    }
    setSaving(false)
  }

  async function handleDelete(name) {
    setDeletingName(name)
    try { await ftDeleteTemplate(name); loadTemplates() } catch { }
    setDeletingName(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <BackButton onClick={onBack} />
        <span className="text-xl">📋</span>
        <h1 className="text-lg font-bold text-violet-700">Create Final Output Template</h1>
      </header>

      <div className="max-w-5xl mx-auto p-6 flex gap-6">
        {/* Left panel — saved templates list */}
        <aside className="w-60 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Saved Templates</h2>
            {loadingTemplates ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : savedTemplates.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No templates saved yet.</p>
            ) : (
              <ul className="space-y-2">
                {savedTemplates.map(t => (
                  <li key={t.name} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate" title={t.name}>{t.name}</p>
                      <p className="text-xs text-gray-400">{t.column_count} columns</p>
                    </div>
                    <button
                      onClick={() => handleDelete(t.name)}
                      disabled={deletingName === t.name}
                      className="shrink-0 text-gray-400 hover:text-red-500 transition-colors text-xs leading-none"
                      title="Delete"
                    >
                      {deletingName === t.name ? '…' : '✕'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right panel — create form */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* Step 1 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Step 1 — Upload Golden Excel File
            </h2>
            <FileDropZone
              onFile={handleFile}
              file={file}
              accept=".xlsx"
              label="Drop your golden .xlsx file here"
            />
            <p className="text-xs text-gray-400 mt-2">
              Only <strong>.xlsx</strong> files are accepted — Excel header colors cannot be read from CSV files.
            </p>
            {extracting && (
              <div className="mt-3 flex items-center gap-2 text-xs text-violet-600">
                <div className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                Reading columns and header colors…
              </div>
            )}
            {extractError && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {extractError}
              </div>
            )}
          </div>

          {/* Step 2 — Column preview */}
          {columns.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Step 2 — Detected Columns &amp; Colors ({columns.length})
              </h2>
              <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
                {columns.map((col, i) => {
                  const hex = argbToHex(col.argb)
                  const isTheme = col.argb.startsWith('theme:')
                  const noFill  = col.argb === '00000000' || col.argb.startsWith('indexed:')
                  return (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50">
                      <span className="text-xs text-gray-400 w-6 text-right shrink-0 tabular-nums">{i + 1}</span>
                      <span
                        title={
                          hex      ? `Color: #${col.argb.slice(2)} (ARGB: ${col.argb})` :
                          isTheme  ? `Theme color (${col.argb}) — no fixed hex value` :
                          noFill   ? 'No fill / transparent' : col.argb
                        }
                        style={
                          hex
                            ? { background: hex, border: '1px solid rgba(0,0,0,0.1)' }
                            : { background: '#f3f4f6', border: '1px dashed #d1d5db' }
                        }
                        className="w-4 h-4 rounded shrink-0"
                      />
                      <span className="text-sm text-gray-800">{col.name}</span>
                      {(isTheme || noFill) && (
                        <span className="text-xs text-gray-400 italic ml-1">
                          {isTheme ? 'theme color' : 'no fill'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3 — Name and save */}
          {columns.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Step 3 — Name &amp; Save Template
              </h2>
              <div className="flex gap-3 items-start flex-wrap">
                <div className="flex-1 min-w-48">
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    placeholder="e.g. healthcare_output"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Letters, numbers, underscores, hyphens only</p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !templateName.trim() || columns.length === 0}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Template'}
                </button>
              </div>
              {msg && (
                <div className={`mt-3 text-xs rounded-lg px-3 py-2 border ${
                  msg.type === 'ok'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  {msg.text}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Check & Arrange sub-view ──────────────────────────────────────────────────

function CheckArrangeView({ onBack }) {
  const [templates,        setTemplates]        = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [file,             setFile]             = useState(null)
  const [checking,         setChecking]         = useState(false)
  const [checkError,       setCheckError]       = useState(null)
  const [checkResult,      setCheckResult]      = useState(null)
  const [userMappings,     setUserMappings]     = useState([])
  const [normalizing,      setNormalizing]      = useState(false)
  const [msg,              setMsg]              = useState(null)

  useEffect(() => {
    ftListTemplates().then(setTemplates).catch(() => {})
  }, [])

  function handleFile(f) {
    setFile(f)
    setCheckResult(null)
    setUserMappings([])
    setCheckError(null)
    setMsg(null)
  }

  function handleTemplateChange(name) {
    setSelectedTemplate(name)
    setCheckResult(null)
    setUserMappings([])
    setMsg(null)
  }

  async function handleCheck() {
    if (!file || !selectedTemplate) return
    setChecking(true)
    setCheckError(null)
    setCheckResult(null)
    setUserMappings([])
    setMsg(null)
    try {
      const result = await ftCheckFile(file, selectedTemplate)
      setCheckResult(result)
      setUserMappings(result.mappings.map(m => ({ ...m })))
    } catch (e) {
      setCheckError(e.response?.data?.detail || 'Check failed. Please try again.')
    }
    setChecking(false)
  }

  function handleOverride(idx, newFileCol) {
    setUserMappings(prev => prev.map((m, i) =>
      i === idx ? { ...m, file_col: newFileCol === '__skip__' ? null : newFileCol } : m
    ))
  }

  async function handleNormalize() {
    if (!file || !selectedTemplate || !checkResult) return
    setNormalizing(true)
    setMsg(null)
    try {
      const resp = await ftNormalizeDownload(file, selectedTemplate, userMappings)
      const url = URL.createObjectURL(resp.data)
      const a = document.createElement('a')
      a.href = url
      const stem = file.name.replace(/\.[^.]+$/, '')
      a.download = `${stem}_normalized.xlsx`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 200)
      setMsg({ type: 'ok', text: 'Download started!' })
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || 'Normalization failed. Please try again.' })
    }
    setNormalizing(false)
  }

  const STATUS_CONFIG = {
    exact_match:     { cls: 'bg-green-50 border-green-200 text-green-700',   icon: '✓' },
    reorder_only:    { cls: 'bg-amber-50 border-amber-200 text-amber-700',   icon: '⇅' },
    needs_work:      { cls: 'bg-violet-50 border-violet-200 text-violet-700', icon: '✏' },
    missing_columns: { cls: 'bg-red-50 border-red-200 text-red-700',         icon: '⚠' },
  }

  const STATUS_TEXT = {
    exact_match:     'File already matches the template perfectly — no changes needed.',
    reorder_only:    'All columns found but in wrong order. Normalize will reorder them.',
    needs_work:      'Some columns need renaming or confirmation. Review the mapping below.',
    missing_columns: 'One or more template columns are missing from the file.',
  }

  // All file columns referenced anywhere in the check result (for override dropdowns)
  const allFileCols = checkResult
    ? [...new Set([
        ...checkResult.mappings.map(m => m.file_col).filter(Boolean),
        ...(checkResult.file_extra_cols || []),
        ...checkResult.mappings.flatMap(m => m.suggestions || []),
      ])]
    : []

  const missingCount = userMappings.filter(m => m.action === 'missing' && !m.file_col).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <BackButton onClick={onBack} />
        <span className="text-xl">🔍</span>
        <h1 className="text-lg font-bold text-violet-700">Check &amp; Arrange</h1>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-5">

        {/* Controls card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                File to Check
              </p>
              <FileDropZone
                onFile={handleFile}
                file={file}
                accept=".xlsx,.csv"
                label="Drop .xlsx or .csv file here"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Final Template
              </p>
              <select
                value={selectedTemplate}
                onChange={e => handleTemplateChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-500"
              >
                <option value="">— Select a template —</option>
                {templates.map(t => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.column_count} cols)
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  No final templates saved yet — create one first.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCheck}
              disabled={!file || !selectedTemplate || checking}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {checking
                ? <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Checking…
                  </span>
                : 'Check File'}
            </button>
          </div>

          {checkError && (
            <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {checkError}
            </div>
          )}
        </div>

        {/* Check results */}
        {checkResult && (
          <>
            {/* Status banner */}
            {(() => {
              const cfg = STATUS_CONFIG[checkResult.overall_status] || STATUS_CONFIG.needs_work
              const txt = STATUS_TEXT[checkResult.overall_status] || ''
              return (
                <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-start gap-2 ${cfg.cls}`}>
                  <span className="text-base leading-none mt-0.5">{cfg.icon}</span>
                  <span>
                    {checkResult.overall_status === 'missing_columns'
                      ? `${txt.replace('One or more', `${missingCount}`)} ${missingCount > 0 ? `(${missingCount} missing)` : ''}`
                      : txt}
                  </span>
                </div>
              )
            })()}

            {/* Mapping review table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">Column Mapping Review</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  For auto-rename and fuzzy matches, you can override which file column maps to each template column.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-violet-50 text-violet-800 text-xs font-semibold">
                      <th className="text-left px-4 py-2.5 w-8">#</th>
                      <th className="text-left px-4 py-2.5">Template Column</th>
                      <th className="text-left px-4 py-2.5">Matched File Column</th>
                      <th className="text-left px-4 py-2.5">Action</th>
                      <th className="text-left px-4 py-2.5">Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userMappings.map((m, idx) => {
                      const origAction  = checkResult.mappings[idx]?.action
                      const suggestions = checkResult.mappings[idx]?.suggestions || []
                      const needsOverride = ['auto_rename', 'fuzzy_suggest', 'missing'].includes(origAction)

                      // Build override options: current file_col first, then suggestions, then all other file cols
                      const dropdownOpts = [...new Set([
                        ...(m.file_col ? [m.file_col] : []),
                        ...suggestions,
                        ...allFileCols,
                      ])]

                      return (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-xs text-gray-400 tabular-nums">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{m.template_col}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">
                            {m.file_col
                              ? <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{m.file_col}</code>
                              : <span className="text-gray-300 italic">not found</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <ActionBadge action={origAction} confidence={checkResult.mappings[idx]?.confidence} />
                          </td>
                          <td className="px-4 py-2.5">
                            {needsOverride ? (
                              <select
                                value={m.file_col || '__skip__'}
                                onChange={e => handleOverride(idx, e.target.value)}
                                className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 max-w-52"
                              >
                                <option value="__skip__">— Skip (exclude) —</option>
                                {dropdownOpts.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Extra columns notice */}
            {checkResult.file_extra_cols?.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-500">
                <span className="font-semibold text-gray-600">Columns not in template</span> (will be excluded from output):{' '}
                {checkResult.file_extra_cols.map((fc, i) => (
                  <code key={i} className="bg-white border border-gray-200 px-1.5 py-0.5 rounded ml-1">{fc}</code>
                ))}
              </div>
            )}

            {/* Normalize & Download */}
            <div className="flex justify-end items-center gap-4 pb-4">
              {msg && (
                <span className={`text-xs font-medium ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                  {msg.text}
                </span>
              )}
              <button
                onClick={handleNormalize}
                disabled={normalizing}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {normalizing
                  ? <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Normalizing…
                    </span>
                  : '⬇ Normalize & Download'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main component — landing sub-mode chooser ────────────────────────────────

export default function FinalOutputTemplateManager({ onBack }) {
  const [subMode, setSubMode] = useState(null)

  if (subMode === 'create') return <CreateTemplateView onBack={() => setSubMode(null)} />
  if (subMode === 'check')  return <CheckArrangeView   onBack={() => setSubMode(null)} />

  const SUB_MODES = [
    {
      id:   'create',
      icon: '📋',
      title: 'Create Template',
      desc:  'Upload a golden .xlsx file to capture the exact column order and header colors as a reusable final output template.',
    },
    {
      id:   'check',
      icon: '🔍',
      title: 'Check & Arrange',
      desc:  'Upload any file and select a template to auto-detect mismatches, rearrange columns, rename headers, and download the normalized output.',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <BackButton onClick={onBack} />
        <span className="text-2xl">🎯</span>
        <h1 className="text-xl font-bold text-violet-700">Output Normalizer</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Final Output QC</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Capture a golden output template with exact column order and header colors, then
            check and normalize any file to match it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
          {SUB_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setSubMode(m.id)}
              className="group bg-white border-2 border-gray-200 hover:border-violet-500 hover:shadow-xl
                         rounded-2xl p-8 text-left transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-violet-600 scale-x-0 group-hover:scale-x-100
                              transition-transform duration-200 origin-left rounded-t-2xl" />
              <div className="text-4xl mb-4">{m.icon}</div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-violet-700 mb-2 transition-colors">
                {m.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>
              <div className="mt-5 flex items-center text-xs font-semibold text-violet-600
                              opacity-0 group-hover:opacity-100 transition-opacity">
                Get started
                <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
