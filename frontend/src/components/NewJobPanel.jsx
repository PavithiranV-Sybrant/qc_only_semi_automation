import { useState, useRef, useCallback } from 'react'
import { uploadFile, batchUpload, startPipeline, runBatch } from '../api'
import ColumnMapper     from './ColumnMapper'
import PipelineControls from './PipelineControls'

// ─── File drop zone ───────────────────────────────────────────────────────

function DropZone({ multiple, onFiles, disabled }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)

  function handleFiles(fileList) {
    const arr = Array.from(fileList).filter(f => /\.(xlsx|csv)$/i.test(f.name))
    if (arr.length) onFiles(arr)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) handleFiles(e.dataTransfer.files) }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors
        ${over ? 'border-violet-500 bg-violet-50' : 'border-gray-300 hover:border-violet-400 hover:bg-gray-50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.csv" multiple={multiple}
        className="hidden" onChange={e => handleFiles(e.target.files)} />
      <div className="text-2xl mb-2">{multiple ? '📂' : '📄'}</div>
      <p className="text-sm font-medium text-gray-600">
        Drop {multiple ? 'files' : 'a file'} here or click to browse
      </p>
      <p className="text-xs text-gray-400 mt-1">.xlsx or .csv</p>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────

export default function NewJobPanel({ open, onClose, onSubmitted }) {
  const [type,          setType]          = useState('single')   // 'single' | 'batch'
  const [uploadedFiles, setUploadedFiles] = useState([])         // raw File objects
  const [uploading,     setUploading]     = useState(false)
  const [uploadPct,     setUploadPct]     = useState(0)
  const [sessionId,     setSessionId]     = useState(null)       // single mode
  const [batchId,       setBatchId]       = useState(null)       // batch mode
  const [columnNames,   setColumnNames]   = useState([])
  const [columnMapping, setColumnMapping] = useState(null)
  const [toggles,       setToggles]       = useState({})
  const [thresholds,    setThresholds]    = useState({ name_email_fuzzy: 80, linkedin_fuzzy: 0.5 })
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState(null)
  const [toast,         setToast]         = useState(null)

  function resetState() {
    setUploadedFiles([]); setUploading(false); setUploadPct(0)
    setSessionId(null); setBatchId(null); setColumnNames([])
    setColumnMapping(null); setToggles({}); setThresholds({ name_email_fuzzy: 80, linkedin_fuzzy: 0.5 })
    setSubmitting(false); setError(null)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  function switchType(t) {
    setType(t)
    resetState()
  }

  async function handleFiles(files) {
    setError(null)
    setUploadedFiles(files)
    setUploading(true)
    setUploadPct(0)
    try {
      if (type === 'single') {
        const data = await uploadFile(files[0], pct => setUploadPct(pct))
        setSessionId(data.session_id)
        setColumnNames(data.column_names || [])
      } else {
        const data = await batchUpload(files, pct => setUploadPct(pct))
        setBatchId(data.batch_id)
        // Use first file's columns for mapping (same mapping applied to all files)
        setColumnNames(data.files?.[0]?.column_names || [])
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Upload failed.')
      setUploadedFiles([])
    } finally {
      setUploading(false)
      setUploadPct(0)
    }
  }

  async function handleSubmit() {
    if (!columnMapping) { setError('Map your columns first.'); return }
    setSubmitting(true)
    setError(null)
    try {
      if (type === 'single') {
        const { job_id } = await startPipeline(sessionId, columnMapping, toggles, thresholds)
        showToast('Job added to queue')
        onSubmitted?.({ type: 'single', id: job_id })
      } else {
        await runBatch(batchId, columnMapping, toggles, thresholds)
        showToast('Batch added to queue')
        onSubmitted?.({ type: 'batch', id: batchId })
      }
      handleClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit job.')
    } finally {
      setSubmitting(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const hasUpload = sessionId || batchId
  const isReady   = hasUpload && columnMapping

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={handleClose} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Slide-in panel */}
      <aside className={`fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl
        transition-transform duration-300 ease-in-out
        w-full sm:w-[480px] md:w-[520px]
        ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <button onClick={handleClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-base font-bold text-gray-800">Add New Job</h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Type selector */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Job Type</p>
            <div className="grid grid-cols-2 gap-2">
              {[['single', '📄', 'Single File'], ['batch', '📂', 'Batch']].map(([id, icon, label]) => (
                <button key={id} onClick={() => switchType(id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all
                    ${type === id
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <span className="text-lg">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* File upload */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {type === 'single' ? 'File' : 'Files'}
            </p>

            {!hasUpload ? (
              <DropZone
                multiple={type === 'batch'}
                onFiles={handleFiles}
                disabled={uploading}
              />
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-green-800 font-medium truncate">
                    {uploadedFiles.length === 1
                      ? uploadedFiles[0].name
                      : `${uploadedFiles.length} files uploaded`}
                  </div>
                  <button onClick={resetState}
                    className="ml-2 text-green-500 hover:text-red-500 transition-colors text-base shrink-0">✕</button>
                </div>
              </div>
            )}

            {uploading && (
              <div className="mt-2">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadPct}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-center">Uploading… {uploadPct}%</p>
              </div>
            )}
          </section>

          {/* Column mapping — shown after upload */}
          {hasUpload && columnNames.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Column Mapping</p>
              <ColumnMapper columns={columnNames} onMappingChange={setColumnMapping} />
              {columnMapping && (
                <p className="text-xs text-green-600 mt-1">✓ {Object.keys(columnMapping).length} columns mapped</p>
              )}
            </section>
          )}

          {/* Pipeline config — shown after upload */}
          {hasUpload && (
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pipeline Steps</p>
              <PipelineControls
                hideRunButton
                mappingApplied={!!columnMapping}
                onConfigChange={(t, th) => { setToggles(t); setThresholds(th) }}
              />
            </section>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleSubmit}
            disabled={!isReady || submitting}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed
              text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
            {submitting ? '⏳ Adding to queue…' : '+ Add to Queue'}
          </button>
          {!isReady && hasUpload && !columnMapping && (
            <p className="text-xs text-amber-500 mt-1.5 text-center">Map your columns to continue</p>
          )}
          {!hasUpload && (
            <p className="text-xs text-gray-400 mt-1.5 text-center">Upload a file to continue</p>
          )}
        </div>
      </aside>
    </>
  )
}
