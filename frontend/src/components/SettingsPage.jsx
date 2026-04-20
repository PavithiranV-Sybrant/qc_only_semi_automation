import { useState, useEffect, useCallback } from 'react'
import {
  getSettings, saveSettings,
  listStoredFiles, deleteStoredFile, deleteAllStoredFiles, runCleanup,
  storedFileDownloadUrl,
  getLLMSettings, saveLLMSettings, testLLMConnection, listLLMModels,
} from '../api'

function fmtSize(bytes) {
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso) {
  // iso is UTC (ends in +00:00 or Z); parse and show in local time
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function BackIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

export default function SettingsPage({ onBack }) {
  const [backupDays,     setBackupDays]     = useState(7)
  const [files,          setFiles]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [cleaning,       setCleaning]       = useState(false)
  const [deletingId,     setDeletingId]     = useState(null)
  const [confirmDelAll,  setConfirmDelAll]  = useState(false)
  const [deletingAll,    setDeletingAll]    = useState(false)
  const [msg,            setMsg]            = useState(null)  // { type:'ok'|'err', text }

  // ── LLM settings state ────────────────────────────────────────────────────
  const [llmProvider,   setLlmProvider]   = useState('groq')
  const [llmApiKey,     setLlmApiKey]     = useState('')
  const [llmModel,      setLlmModel]      = useState('llama-3.3-70b-versatile')
  const [llmModels,     setLlmModels]     = useState([])
  const [showKey,       setShowKey]       = useState(false)
  const [editingKey,    setEditingKey]    = useState(false)
  const [keyDraft,      setKeyDraft]      = useState('')
  const [savingLLM,     setSavingLLM]     = useState(false)
  const [testingConn,   setTestingConn]   = useState(false)
  const [connStatus,    setConnStatus]    = useState(null)  // null | 'ok' | 'err'
  const [connMsg,       setConnMsg]       = useState('')

  const showMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const loadData = useCallback(async () => {
    try {
      const [settings, stored, llmCfg, modelsRes] = await Promise.all([
        getSettings(), listStoredFiles(), getLLMSettings(), listLLMModels(),
      ])
      setBackupDays(settings.backup_days)
      setFiles(stored)
      setLlmProvider(llmCfg.llm_provider || 'groq')
      setLlmApiKey(llmCfg.llm_api_key   || '')
      setLlmModel(llmCfg.llm_model      || 'llama-3.3-70b-versatile')
      setLlmModels(modelsRes.models      || [])
    } catch {
      showMsg('err', 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleSave() {
    setSaving(true)
    try {
      await saveSettings({ backup_days: backupDays })
      showMsg('ok', 'Settings saved.')
    } catch {
      showMsg('err', 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCleanup() {
    setCleaning(true)
    try {
      const result = await runCleanup()
      await loadData()
      const n = result.deleted_count
      showMsg('ok', n > 0 ? `Removed ${n} file${n !== 1 ? 's' : ''} older than ${result.backup_days} day${result.backup_days !== 1 ? 's' : ''}.` : 'No files needed cleanup.')
    } catch {
      showMsg('err', 'Cleanup failed.')
    } finally {
      setCleaning(false)
    }
  }

  async function handleDeleteOne(id) {
    setDeletingId(id)
    try {
      await deleteStoredFile(id)
      setFiles(f => f.filter(x => x.id !== id))
    } catch {
      showMsg('err', 'Delete failed.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSaveLLM() {
    setSavingLLM(true)
    try {
      await saveLLMSettings({ llm_provider: llmProvider, llm_api_key: llmApiKey, llm_model: llmModel })
      showMsg('ok', 'LLM settings saved.')
      setEditingKey(false)
    } catch {
      showMsg('err', 'Failed to save LLM settings.')
    } finally {
      setSavingLLM(false)
    }
  }

  async function handleTestConnection() {
    setTestingConn(true)
    setConnStatus(null)
    try {
      const res = await testLLMConnection()
      setConnStatus('ok')
      setConnMsg(`Connected — model replied: "${res.reply}"`)
    } catch (e) {
      setConnStatus('err')
      setConnMsg(e.response?.data?.detail || 'Connection failed.')
    } finally {
      setTestingConn(false)
    }
  }

  function startEditKey() {
    setKeyDraft(llmApiKey)
    setEditingKey(true)
    setShowKey(true)
  }

  function cancelEditKey() {
    setEditingKey(false)
    setKeyDraft('')
    setShowKey(false)
  }

  function applyKeyDraft() {
    setLlmApiKey(keyDraft)
    setEditingKey(false)
    setShowKey(false)
  }

  async function handleDeleteAll() {
    setDeletingAll(true)
    try {
      const result = await deleteAllStoredFiles()
      setFiles([])
      setConfirmDelAll(false)
      showMsg('ok', `Deleted ${result.deleted_count} file${result.deleted_count !== 1 ? 's' : ''}.`)
    } catch {
      showMsg('err', 'Delete all failed.')
    } finally {
      setDeletingAll(false)
    }
  }

  const totalSize = files.reduce((s, f) => s + (f.size_bytes || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={onBack}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
            title="Back to home">
            <BackIcon />
          </button>
          <h1 className="text-lg font-bold text-violet-700">Settings</h1>
          {msg && (
            <span className={`ml-auto text-xs px-3 py-1 rounded-full font-medium
              ${msg.type === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {msg.text}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* ── LLM Configuration ─────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            LLM Configuration
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">

            {/* Provider */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Provider</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-violet-700 font-bold bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg">
                  🤖 Groq
                </span>
                <span className="text-xs text-gray-400">Fast inference via GroqCloud API</span>
              </div>
            </div>

            {/* API Key Manager */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                API Key
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
                  className="ml-2 text-xs font-normal text-violet-500 hover:text-violet-700">
                  Get a key ↗
                </a>
              </label>

              {editingKey ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={keyDraft}
                      onChange={e => setKeyDraft(e.target.value)}
                      placeholder="gsk_..."
                      className="flex-1 text-sm border border-violet-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                      autoFocus
                    />
                    <button onClick={() => setShowKey(v => !v)}
                      className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:border-gray-400 text-gray-500">
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={applyKeyDraft}
                      className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors">
                      Apply
                    </button>
                    <button onClick={cancelEditKey}
                      className="border border-gray-300 hover:border-gray-400 text-gray-600 text-xs px-4 py-1.5 rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`flex-1 text-sm font-mono px-3 py-2 rounded-lg border
                    ${llmApiKey ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                    {llmApiKey
                      ? (showKey ? llmApiKey : `${llmApiKey.slice(0, 8)}${'•'.repeat(Math.min(20, llmApiKey.length - 12))}${llmApiKey.slice(-4)}`)
                      : 'No API key saved'}
                  </span>
                  {llmApiKey && (
                    <button onClick={() => setShowKey(v => !v)}
                      className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:border-gray-400 text-gray-500">
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  )}
                  <button onClick={startEditKey}
                    className="px-3 py-2 text-xs font-semibold border border-violet-300 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                    {llmApiKey ? 'Edit' : '+ Add Key'}
                  </button>
                </div>
              )}
            </div>

            {/* Model Selector */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Model</label>
              <select
                value={llmModel}
                onChange={e => setLlmModel(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-violet-400"
              >
                {(llmModels.length ? llmModels : [{ id: llmModel, name: llmModel, context: '' }]).map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.context ? ` — ${m.context} context` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Rate limits (free tier): 30 req/min · 6K tokens/min · 1,000 req/day
              </p>
            </div>

            {/* Connection test result */}
            {connStatus && (
              <div className={`text-xs px-3 py-2 rounded-lg font-medium
                ${connStatus === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {connStatus === 'ok' ? '✓ ' : '✗ '}{connMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <button onClick={handleSaveLLM} disabled={savingLLM}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                {savingLLM ? 'Saving…' : 'Save LLM Settings'}
              </button>
              <button onClick={handleTestConnection} disabled={testingConn || !llmApiKey}
                className="border border-gray-300 hover:border-violet-400 hover:text-violet-700 text-gray-600 text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40">
                {testingConn ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Storage Settings ──────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Storage Settings
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-gray-700">
                  Backup Retention
                </label>
                <span className="text-sm font-bold text-violet-700">
                  {backupDays} day{backupDays !== 1 ? 's' : ''}
                </span>
              </div>
              <input
                type="range" min={1} max={90} value={backupDays}
                onChange={e => setBackupDays(+e.target.value)}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1 day</span>
                <span>90 days</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Processed files older than <strong>{backupDays} day{backupDays !== 1 ? 's' : ''}</strong> are
                automatically deleted when the app starts and once every 24 hours.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
              <button onClick={handleCleanup} disabled={cleaning}
                className="border border-gray-300 hover:border-violet-400 hover:text-violet-700 text-gray-600 text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
                {cleaning ? 'Cleaning…' : 'Clean Up Now'}
              </button>
            </div>
          </div>
        </section>

        {/* ── File History ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              File History
              {files.length > 0 && (
                <span className="ml-2 font-normal normal-case text-gray-400">
                  — {files.length} file{files.length !== 1 ? 's' : ''}, {fmtSize(totalSize)} total
                </span>
              )}
            </h2>

            {files.length > 0 && !confirmDelAll && (
              <button onClick={() => setConfirmDelAll(true)}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                Delete All
              </button>
            )}
            {confirmDelAll && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Delete all {files.length} files?</span>
                <button onClick={handleDeleteAll} disabled={deletingAll}
                  className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-1 rounded transition-colors disabled:opacity-50">
                  {deletingAll ? 'Deleting…' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmDelAll(false)}
                  className="text-xs text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              Loading…
            </div>
          ) : files.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <div className="text-4xl mb-3">🗄️</div>
              <p className="text-sm text-gray-500 font-medium">No stored files yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Files appear here after you run the pipeline. They persist across app restarts.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="text-xl shrink-0">📄</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.file_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDate(f.saved_at)}
                      <span className="mx-1.5">·</span>
                      {fmtSize(f.size_bytes)}
                      {f.original_name && f.original_name !== f.file_name && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="text-gray-300">from</span>{' '}
                          <span className="text-gray-400">{f.original_name}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <a
                    href={storedFileDownloadUrl(f.id)}
                    download={f.file_name}
                    className="shrink-0 flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ↓ Download
                  </a>
                  <button
                    onClick={() => handleDeleteOne(f.id)}
                    disabled={deletingId === f.id}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Delete"
                  >
                    {deletingId === f.id ? (
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
