import { useState, useEffect, useRef } from 'react'
import FileUpload       from './FileUpload'
import PipelineResults  from './PipelineResults'
import PipelineAnalysis from './PipelineAnalysis'
import {
  uploadFile, autonomousAnalyze,
  startPipeline, pollJobStatus, cancelPipeline,
} from '../api'

// ── Static config ──────────────────────────────────────────────────────────

const ROLES = [
  ['first_name',           'First Name'],
  ['last_name',            'Last Name'],
  ['middle_name',          'Middle Name'],
  ['full_name',            'Full Name (unsplit)'],
  ['company',              'Company'],
  ['email',                'Email'],
  ['office_state',         'Office State'],
  ['employee_count',       'Employee Count'],
  ['linkedin',             'LinkedIn URL'],
  ['primary_industry',     'Primary Industry'],
  ['job_title',            'Job Title'],
  ['sic_code',             'SIC Code'],
  ['link_text',            'Link Text'],
  ['description',          'Description'],
  ['unique_identifier',    'Unique Identifier'],
  ['facebook',             'Facebook URL'],
  ['facebook_link_text',   'Facebook Link Text'],
  ['facebook_description', 'Facebook Description'],
]

const STEP_LABELS = {
  name_split:                '0. Split Full Name',
  dot_remove:                '1. Remove Dots from Names',
  name_company_match:        '2. Name / Company Match',
  non_alpha_name_handle:     '3. Non-alpha Characters in Names',
  email_structure_validation:'5. Email Structure Validation',
  company_email_domain_match:'6. Company / Email Domain Match',
  name_email_fuzzy_match:    '7. Name / Email Fuzzy Match',
  normalize_phone_excel:     '8. Normalize Phone Numbers',
  validate_phone_state:      '9. Phone / State Validation',
  normalize_employee_count:  '10. Normalize Employee Count',
  name_linkedin_fuzzy_match: '11. LinkedIn Name Match',
  extract_primary_industry:  '12. Extract Primary Industry',
  job_title_categories:      '13. Job Title Categorization',
  sic_code_naics:            '14. SIC → NAICS Mapping',
  link_text_match:           '15. Link Text / Description Match',
  unique_identifier_check:   '16. Unique Identifier Check',
  facebook_match:            '17. Facebook Name Match',
}

const DEFAULT_THRESHOLDS = {
  name_email_fuzzy: 80,
  linkedin_fuzzy:   0.5,
  link_text_fuzzy:  85,
  facebook_fuzzy:   0.5,
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AutonomousAgent({ onBack }) {
  // phase: upload | analyzing | review | running | done
  const [phase,          setPhase]          = useState('upload')

  // upload
  const [uploading,      setUploading]      = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)

  // session / file
  const [sessionId,      setSessionId]      = useState(null)
  const [fileInfo,       setFileInfo]       = useState(null)
  const [columns,        setColumns]        = useState([])

  // LLM result + editable state
  const [llmResult,      setLlmResult]      = useState(null)
  const [mapping,        setMapping]        = useState({})
  const [phoneColumns,   setPhoneColumns]   = useState([])
  const [steps,          setSteps]          = useState({})
  const [thresholds,     setThresholds]     = useState(DEFAULT_THRESHOLDS)

  // pipeline / job
  const [jobId,          setJobId]          = useState(null)
  const [jobProgress,    setJobProgress]    = useState(null)
  const [pipelineData,   setPipelineData]   = useState(null)
  const [downloadReady,  setDownloadReady]  = useState(false)
  const [preparingDl,    setPreparingDl]    = useState(false)

  const [error,          setError]          = useState(null)
  const [resultTab,      setResultTab]      = useState('results')
  const pollRef = useRef(null)

  // ── Poll pipeline ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollJobStatus(jobId)
        setJobProgress(job)
        if (job.status === 'preparing_download') setPreparingDl(true)
        if (job.status === 'done') {
          clearInterval(pollRef.current)
          setJobId(null)
          setPreparingDl(false)
          setDownloadReady(true)
          setPipelineData(job)
          setPhase('done')
          setResultTab('results')
        } else if (job.status === 'error') {
          clearInterval(pollRef.current)
          setJobId(null)
          setPreparingDl(false)
          setError(job.error || 'Pipeline failed.')
          setPhase('review')
        }
      } catch {
        clearInterval(pollRef.current)
        setJobId(null)
        setError('Lost connection to server.')
        setPhase('review')
      }
    }, 2000)
    return () => clearInterval(pollRef.current)
  }, [jobId])

  // ── Handlers ───────────────────────────────────────────────────────────

  async function handleUpload(file) {
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    try {
      const data = await uploadFile(file, setUploadProgress)
      setSessionId(data.session_id)
      setFileInfo({ file_name: data.file_name, rows: data.rows, columns: data.columns })
      setColumns(data.column_names)
      setPhase('analyzing')
      await runAnalysis(data.session_id, data.column_names)
    } catch (e) {
      setError(e.response?.data?.detail || 'Upload failed.')
      setPhase('upload')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  async function runAnalysis(sid, knownColumns) {
    const cols = knownColumns || columns
    try {
      const result = await autonomousAnalyze(sid || sessionId)
      setLlmResult(result)

      // Populate editable mapping from LLM result
      const m = {}
      for (const [role] of ROLES) {
        const val = result.column_mapping?.[role]
        if (val && cols.includes(val)) m[role] = val
      }
      const rawPhone = result.column_mapping?.phone_columns || []
      const validPhone = Array.isArray(rawPhone) ? rawPhone.filter(c => cols.includes(c)) : []

      setMapping(m)
      setPhoneColumns(validPhone)
      setSteps(result.steps || {})
      setPhase('review')
    } catch (e) {
      const msg = e.response?.data?.detail || 'LLM analysis failed.'
      setError(msg)
      // Still enter review so the user can configure manually
      setPhase('review')
    }
  }

  async function handleRun() {
    setError(null)
    const colMap = { ...mapping, phone_columns: phoneColumns }
    setJobProgress({ status: 'pending', step_index: 0, total_steps: 0, current_step: 'Starting…' })
    setPhase('running')
    try {
      const { job_id } = await startPipeline(sessionId, colMap, steps, thresholds)
      setJobId(job_id)
    } catch (e) {
      setJobProgress(null)
      setError(e.response?.data?.detail || 'Failed to start pipeline.')
      setPhase('review')
    }
  }

  async function handleCancel() {
    if (!jobId) return
    try {
      await cancelPipeline(jobId)
      clearInterval(pollRef.current)
      setJobId(null)
      setJobProgress(prev => ({ ...prev, status: 'cancelled', current_step: 'Cancelled.' }))
      setPhase('review')
    } catch {
      setError('Failed to cancel.')
    }
  }

  function handleReset() {
    clearInterval(pollRef.current)
    setPhase('upload')
    setSessionId(null); setFileInfo(null); setColumns([])
    setLlmResult(null); setMapping({}); setPhoneColumns([]); setSteps({})
    setThresholds(DEFAULT_THRESHOLDS)
    setJobId(null); setJobProgress(null); setPipelineData(null)
    setDownloadReady(false); setPreparingDl(false); setError(null)
  }

  const colOptions    = ['', ...columns]
  const isRunning     = !!jobId || ['running', 'pending', 'preparing_download'].includes(jobProgress?.status)
  const progressPct   = jobProgress?.total_steps > 0
    ? Math.round((jobProgress.step_index / jobProgress.total_steps) * 100) : 0
  const mappedCount   = Object.values(mapping).filter(Boolean).length + phoneColumns.length
  const enabledSteps  = Object.values(steps).filter(Boolean).length

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={onBack}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
            title="Back to home">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xl">🤖</span>
          <h1 className="text-lg font-bold text-violet-700">Fully Autonomous Agent</h1>
          {llmResult?.model_used && (
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
              {llmResult.model_used}
            </span>
          )}
          {phase === 'review' && mappedCount > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium ml-auto">
              {mappedCount} columns mapped · {enabledSteps} steps enabled
            </span>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
            <span className="shrink-0 mt-0.5 font-bold">!</span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600 ml-2">✕</button>
          </div>
        )}

        {/* ── UPLOAD ────────────────────────────────────────────────────────── */}
        {phase === 'upload' && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="text-7xl mb-4">🤖</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload your file</h2>
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto">
                The AI reads your column headers and sample data, then automatically maps every column
                and selects the optimal QC steps — no configuration needed.
              </p>
            </div>
            <FileUpload onUpload={handleUpload} loading={uploading} uploadProgress={uploadProgress} />
            <p className="text-center text-xs text-gray-400 mt-4">
              Make sure your LLM API key is saved in{' '}
              <button onClick={onBack} className="text-violet-500 hover:underline">Settings</button>.
            </p>
          </div>
        )}

        {/* ── ANALYZING ─────────────────────────────────────────────────────── */}
        {phase === 'analyzing' && (
          <div className="max-w-lg mx-auto text-center py-20">
            <div className="text-7xl mb-6 animate-pulse">🤖</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Analyzing your file…</h2>
            <p className="text-gray-500 text-sm mb-8">
              Sending column headers and sample rows to Groq — this usually takes 2–5 seconds.
            </p>
            <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-sm">
              <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm text-gray-600">Waiting for LLM response…</span>
            </div>
            {fileInfo && (
              <p className="text-xs text-gray-400 mt-4">
                {fileInfo.file_name} — {fileInfo.rows?.toLocaleString()} rows × {fileInfo.columns} columns
              </p>
            )}
          </div>
        )}

        {/* ── REVIEW (and RUNNING progress overlay) ─────────────────────────── */}
        {(phase === 'review' || phase === 'running') && (
          <div className="space-y-5">

            {/* File + LLM summary card */}
            {fileInfo && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{fileInfo.file_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fileInfo.rows?.toLocaleString()} rows × {fileInfo.columns} columns
                    </p>
                  </div>
                  {llmResult && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                        ${llmResult.confidence >= 0.8 ? 'bg-green-100 text-green-700'
                          : llmResult.confidence >= 0.5 ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'}`}>
                        {Math.round(llmResult.confidence * 100)}% confidence
                      </span>
                    </div>
                  )}
                </div>
                {llmResult?.reasoning && (
                  <div className="mt-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-violet-700 mb-1">AI Reasoning</p>
                    <p className="text-xs text-violet-900 leading-relaxed">{llmResult.reasoning}</p>
                  </div>
                )}
                {!llmResult && phase === 'review' && (
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-3 py-2 rounded-lg">
                    LLM analysis failed — configure mappings manually below, then run the pipeline.
                  </p>
                )}
              </div>
            )}

            {/* Pipeline progress bar (visible during running phase) */}
            {phase === 'running' && jobProgress && (
              <div className="bg-violet-50 border border-violet-100 rounded-2xl px-5 py-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-violet-700">
                    {jobProgress.status === 'preparing_download'
                      ? '📦 Preparing download file…'
                      : `⏳ ${jobProgress.current_step}`}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-violet-500">
                      {jobProgress.step_index} / {jobProgress.total_steps} steps
                    </span>
                    <button onClick={handleCancel}
                      className="text-xs bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded transition-colors font-medium">
                      ✕ Cancel
                    </button>
                  </div>
                </div>
                <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-600 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {/* Two-column review layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Column Mapping */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Column Mapping</h3>
                  <span className="text-xs text-gray-400">{mappedCount} mapped</span>
                </div>
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {ROLES.map(([role, label]) => (
                    <div key={role} className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-36 shrink-0">{label}</label>
                      <select
                        value={mapping[role] || ''}
                        onChange={e => setMapping(prev => ({
                          ...prev, [role]: e.target.value || undefined,
                        }))}
                        disabled={phase === 'running'}
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white
                                   focus:outline-none focus:border-violet-400 disabled:opacity-50"
                      >
                        {colOptions.map(o => (
                          <option key={o} value={o}>{o || '(unmapped)'}</option>
                        ))}
                      </select>
                      <div className={`w-2 h-2 rounded-full shrink-0
                        ${mapping[role] ? 'bg-green-400' : 'bg-gray-200'}`} />
                    </div>
                  ))}

                  {/* Phone Columns */}
                  <div className="pt-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">Phone Columns</p>
                    <div className="border border-gray-200 rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                      {columns.length === 0 && (
                        <p className="text-xs text-gray-300 italic">No columns loaded</p>
                      )}
                      {columns.map(col => (
                        <label key={col} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox"
                            checked={phoneColumns.includes(col)}
                            disabled={phase === 'running'}
                            onChange={e => setPhoneColumns(prev =>
                              e.target.checked ? [...prev, col] : prev.filter(c => c !== col))}
                            className="accent-violet-600" />
                          {col}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Steps + Thresholds */}
              <div className="space-y-4">

                {/* Pipeline Steps */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Pipeline Steps</h3>
                    <span className="text-xs text-gray-400">{enabledSteps} / {Object.keys(STEP_LABELS).length} enabled</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {Object.entries(STEP_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => phase !== 'running' && setSteps(prev => ({ ...prev, [key]: !prev[key] }))}
                        disabled={phase === 'running'}
                        className="w-full flex items-center gap-2.5 text-left group disabled:cursor-default"
                      >
                        {/* Toggle pill */}
                        <div className={`w-8 h-4 rounded-full relative shrink-0 transition-colors
                          ${steps[key] ? 'bg-violet-600' : 'bg-gray-200'}
                          ${phase !== 'running' ? 'group-hover:opacity-80' : ''}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform
                            ${steps[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className={`text-xs transition-colors
                          ${steps[key] ? 'text-gray-800' : 'text-gray-400'}`}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thresholds */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Thresholds</h3>
                  <div className="space-y-3">
                    {[
                      ['name_email_fuzzy', 'Name ↔ Email',    0, 100, 1,    v => `${v}%`],
                      ['linkedin_fuzzy',   'LinkedIn',         0,   1, 0.05, v => v.toFixed(2)],
                      ['link_text_fuzzy',  'Link Text',        0, 100, 1,    v => `${v}%`],
                      ['facebook_fuzzy',   'Facebook',         0,   1, 0.05, v => v.toFixed(2)],
                    ].map(([key, label, min, max, step, fmt]) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                          <span>{label}</span>
                          <span className="font-medium text-gray-700">{fmt(thresholds[key])}</span>
                        </div>
                        <input type="range" min={min} max={max} step={step}
                          value={thresholds[key]}
                          disabled={phase === 'running'}
                          onChange={e => setThresholds(prev => ({ ...prev, [key]: +e.target.value }))}
                          className="w-full accent-violet-600 disabled:opacity-50" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action row */}
            {phase === 'review' && (
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleRun}
                  disabled={!sessionId}
                  className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white
                             text-sm font-semibold px-8 py-2.5 rounded-xl transition-colors">
                  Run Pipeline
                </button>
                {sessionId && (
                  <button
                    onClick={() => runAnalysis(null, null)}
                    className="border border-violet-300 hover:border-violet-500 text-violet-600
                               text-sm px-5 py-2.5 rounded-xl transition-colors">
                    Re-analyze with AI
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="border border-gray-300 hover:border-gray-400 text-gray-600
                             text-sm px-5 py-2.5 rounded-xl transition-colors ml-auto">
                  Start Over
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── DONE ──────────────────────────────────────────────────────────── */}
        {phase === 'done' && pipelineData && (
          <div className="space-y-5">

            {/* Success banner */}
            <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-4 flex items-center gap-4">
              <span className="text-3xl">✅</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800">Pipeline complete!</p>
                <p className="text-xs text-green-600 mt-0.5">
                  {pipelineData.rows?.toLocaleString()} rows · {pipelineData.elapsed_total}s ·{' '}
                  {pipelineData.new_columns?.length || 0} new columns added
                </p>
              </div>
              <button onClick={handleReset}
                className="text-xs font-semibold text-green-700 hover:text-green-900 border border-green-300
                           hover:border-green-500 px-3 py-1.5 rounded-lg transition-colors">
                New File
              </button>
            </div>

            {/* Preparing download */}
            {preparingDl && !downloadReady && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-xs text-amber-700">
                <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                Preparing Excel download…
              </div>
            )}

            {/* Result tabs */}
            <div className="flex gap-2">
              {[['results', '⚙️ Results'], ['analysis', '🔬 Analysis']].map(([t, lbl]) => (
                <button key={t} onClick={() => setResultTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${resultTab === t ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {lbl}
                </button>
              ))}
            </div>

            {resultTab === 'results' && (
              <PipelineResults
                results={pipelineData.results}
                elapsed={pipelineData.elapsed_total}
                sessionId={sessionId}
                newColsSummary={pipelineData.new_cols_summary}
                downloadReady={downloadReady}
              />
            )}
            {resultTab === 'analysis' && (
              <PipelineAnalysis pipelineData={pipelineData} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
