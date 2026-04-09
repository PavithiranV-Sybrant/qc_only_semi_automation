import { useState, useEffect, useRef } from 'react'
import { uploadFile, startPipeline, pollJobStatus } from './api'
import FileUpload       from './components/FileUpload'
import ColumnMapper     from './components/ColumnMapper'
import PipelineControls from './components/PipelineControls'
import DataPreview      from './components/DataPreview'
import PipelineResults  from './components/PipelineResults'
import PipelineAnalysis from './components/PipelineAnalysis'
import './index.css'

const TABS = [
  { id: 'preview',  label: '📊 Data Preview' },
  { id: 'results',  label: '⚙️ Pipeline Results' },
  { id: 'analysis', label: '🔬 Pipeline Analysis' },
]

export default function App() {
  const [sessionId,     setSessionId]     = useState(null)
  const [fileInfo,      setFileInfo]      = useState(null)
  const [previewRows,   setPreviewRows]   = useState([])
  const [dataQuality,   setDataQuality]   = useState([])
  const [columnMapping, setColumnMapping] = useState(null)
  const [pipelineData,  setPipelineData]  = useState(null)
  const [activeTab,     setActiveTab]     = useState('preview')
  const [uploading,     setUploading]     = useState(false)
  const [largeFile,     setLargeFile]     = useState(false)
  const [error,         setError]         = useState(null)

  // Job / progress state
  const [jobId,         setJobId]         = useState(null)
  const [jobProgress,   setJobProgress]   = useState(null)  // {status, step_index, total_steps, current_step}
  const pollRef = useRef(null)

  // Start polling when jobId is set
  useEffect(() => {
    if (!jobId) return
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollJobStatus(jobId)
        setJobProgress(job)
        if (job.status === 'done') {
          clearInterval(pollRef.current)
          setJobId(null)
          setPipelineData(job)
          setActiveTab('results')
        } else if (job.status === 'error') {
          clearInterval(pollRef.current)
          setJobId(null)
          setError(job.error || 'Pipeline failed.')
        }
      } catch {
        clearInterval(pollRef.current)
        setJobId(null)
        setError('Lost connection to server.')
      }
    }, 2000)
    return () => clearInterval(pollRef.current)
  }, [jobId])

  async function handleUpload(file) {
    setUploading(true); setError(null)
    try {
      const data = await uploadFile(file)
      setSessionId(data.session_id)
      setFileInfo({ file_name: data.file_name, rows: data.rows, columns: data.columns, column_names: data.column_names })
      setPreviewRows(data.preview_rows)
      setDataQuality(data.data_quality)
      setLargeFile(data.large_file || false)
      setColumnMapping(null); setPipelineData(null); setJobProgress(null); setActiveTab('preview')
    } catch (e) { setError(e.response?.data?.detail || 'Upload failed.') }
    finally { setUploading(false) }
  }

  async function handleRun(toggles, thresholds) {
    if (!columnMapping) return
    setError(null); setJobProgress({ status: 'pending', step_index: 0, total_steps: 0, current_step: 'Starting...' })
    try {
      const { job_id } = await startPipeline(sessionId, columnMapping, toggles, thresholds)
      setJobId(job_id)
    } catch (e) {
      setJobProgress(null)
      setError(e.response?.data?.detail || 'Failed to start pipeline.')
    }
  }

  const isRunning = !!jobId || jobProgress?.status === 'running' || jobProgress?.status === 'pending'
  const progressPct = jobProgress?.total_steps > 0
    ? Math.round((jobProgress.step_index / jobProgress.total_steps) * 100)
    : 0

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Sidebar */}
      <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-violet-700">QC Automation</h1>
          <p className="text-xs text-gray-400">Contact data validation pipeline</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upload File</p>
            <FileUpload onUpload={handleUpload} loading={uploading} />
            {fileInfo && (
              <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5">
                <span className="font-medium text-gray-700">{fileInfo.file_name}</span>
                <span className="ml-1">— {fileInfo.rows?.toLocaleString()} rows × {fileInfo.columns} cols</span>
              </div>
            )}
            {largeFile && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                ⚠️ Large file — pipeline may take several minutes. Progress will be shown live.
              </div>
            )}
          </section>

          {fileInfo && (
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Column Mapping</p>
              <ColumnMapper columns={fileInfo.column_names} onMappingChange={setColumnMapping} />
              {columnMapping && (
                <p className="text-xs text-green-600 mt-1">✓ {Object.keys(columnMapping).length} columns mapped</p>
              )}
            </section>
          )}

          {fileInfo && (
            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pipeline</p>
              <PipelineControls onRun={handleRun} loading={isRunning} mappingApplied={!!columnMapping} />
            </section>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-1 h-12 shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} disabled={!fileInfo}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-40
                ${activeTab === t.id ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Live progress bar */}
        {isRunning && jobProgress && (
          <div className="bg-violet-50 border-b border-violet-100 px-6 py-3">
            <div className="flex justify-between text-xs text-violet-700 mb-1.5">
              <span className="font-medium">⏳ {jobProgress.current_step}</span>
              <span>{jobProgress.step_index} / {jobProgress.total_steps} steps</span>
            </div>
            <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {!fileInfo ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">QC Automation Pipeline</h2>
              <p className="text-gray-400 text-sm max-w-sm">
                Upload an Excel or CSV file in the sidebar, map your columns, configure steps, then run the pipeline.
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'preview'  && <DataPreview fileInfo={fileInfo} previewRows={previewRows} dataQuality={dataQuality} />}
              {activeTab === 'results'  && <PipelineResults results={pipelineData?.results} elapsed={pipelineData?.elapsed_total} sessionId={sessionId} newColsSummary={pipelineData?.new_cols_summary} />}
              {activeTab === 'analysis' && <PipelineAnalysis pipelineData={pipelineData} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
