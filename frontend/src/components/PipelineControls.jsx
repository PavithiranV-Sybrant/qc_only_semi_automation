import { useState, useEffect } from 'react'
import { getConfig } from '../api'

export default function PipelineControls({ onRun, loading, mappingApplied, onConfigChange, hideRunButton }) {
  const [stepLabels, setStepLabels] = useState({})
  const [toggles, setToggles]       = useState({})
  const [thresholds, setThresholds] = useState({ name_email_fuzzy: 80, linkedin_fuzzy: 0.5, link_text_fuzzy: 85 })
  const [allOn, setAllOn]           = useState(true)

  useEffect(() => {
    getConfig().then(cfg => {
      setStepLabels(cfg.step_labels || {})
      setToggles(cfg.steps || {})
    })
  }, [])

  // Notify parent of config changes (used by NewJobPanel to capture without a Run button)
  useEffect(() => {
    if (onConfigChange && Object.keys(toggles).length > 0) {
      onConfigChange(toggles, thresholds)
    }
  }, [toggles, thresholds])

  function toggleAll(val) {
    setAllOn(val)
    setToggles(prev => Object.fromEntries(Object.keys(prev).map(k => [k, val])))
  }

  function handleRun() {
    onRun(toggles, thresholds)
  }

  return (
    <div>
      {/* Steps header + All toggle */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">Steps</span>
        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
          All
          <div onClick={() => toggleAll(!allOn)}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer
              ${allOn ? 'bg-violet-600' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
              ${allOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </label>
      </div>

      {/* Step toggles */}
      <div className="space-y-1 max-h-64 overflow-y-auto pr-1 mb-3">
        {Object.entries(stepLabels).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
            <div onClick={() => setToggles(prev => ({ ...prev, [key]: !prev[key] }))}
              className={`relative w-8 h-4 rounded-full transition-colors shrink-0 cursor-pointer
                ${toggles[key] ? 'bg-violet-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform
                ${toggles[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-gray-600">{label}</span>
          </label>
        ))}
      </div>

      <hr className="my-3 border-gray-200" />

      {/* Thresholds */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Name / Email fuzzy</span>
            <span className="font-medium text-gray-700">{thresholds.name_email_fuzzy}</span>
          </div>
          <input type="range" min={0} max={100} value={thresholds.name_email_fuzzy}
            onChange={e => setThresholds(p => ({ ...p, name_email_fuzzy: +e.target.value }))}
            className="w-full accent-violet-600" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>LinkedIn fuzzy</span>
            <span className="font-medium text-gray-700">{thresholds.linkedin_fuzzy.toFixed(2)}</span>
          </div>
          <input type="range" min={0} max={1} step={0.05} value={thresholds.linkedin_fuzzy}
            onChange={e => setThresholds(p => ({ ...p, linkedin_fuzzy: +e.target.value }))}
            className="w-full accent-violet-600" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Link text fuzzy</span>
            <span className="font-medium text-gray-700">{thresholds.link_text_fuzzy}</span>
          </div>
          <input type="range" min={0} max={100} value={thresholds.link_text_fuzzy}
            onChange={e => setThresholds(p => ({ ...p, link_text_fuzzy: +e.target.value }))}
            className="w-full accent-violet-600" />
        </div>
      </div>

      {!hideRunButton && (
        <button onClick={handleRun} disabled={loading || !mappingApplied}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed
            text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
          {loading ? '⏳ Running...' : '▶  Run Pipeline'}
        </button>
      )}
      {!hideRunButton && !mappingApplied && (
        <p className="text-xs text-amber-500 mt-1 text-center">Apply column mapping first</p>
      )}
    </div>
  )
}
