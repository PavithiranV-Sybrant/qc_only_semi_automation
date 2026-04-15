import { useState, useEffect } from 'react'
import { getConfig } from '../api'

const ROLES = [
  ['full_name',        'Full Name (to split)'],
  ['first_name',       'First Name'],
  ['middle_name',      'Middle Name'],
  ['last_name',        'Last Name'],
  ['company',          'Company'],
  ['email',            'Email'],
  ['office_state',     'Office State'],
  ['employee_count',   'Employee Count'],
  ['linkedin',         'LinkedIn'],
  ['primary_industry', 'Primary Industry'],
  ['job_title',        'Job Title'],
  ['sic_code',         'SIC Code'],
  ['link_text',          'Link Text'],
  ['description',        'Description'],
  ['unique_identifier',  'Unique Identifier'],
]

export default function ColumnMapper({ columns, onMappingChange }) {
  const [tab, setTab]         = useState('auto')
  const [mapping, setMapping] = useState({})
  const [phoneColumns, setPhoneColumns] = useState([])
  const [templates, setTemplates] = useState({})
  const [detectedTemplate, setDetectedTemplate] = useState('')

  useEffect(() => {
    getConfig().then(cfg => {
      setTemplates(cfg.templates || {})
      // Auto-detect best template by fuzzy-matching column names
      autoDetect(cfg.templates || {}, cfg.columns || {})
    })
  }, [columns])

  function autoDetect(tmpls, defaultCols) {
    // Simple score: count how many template expected columns exist in file columns
    let bestName = '', bestMap = defaultCols, bestScore = -1
    for (const [name, colMap] of Object.entries(tmpls)) {
      let score = 0
      for (const [, expected] of Object.entries(colMap)) {
        if (Array.isArray(expected)) {
          expected.forEach(e => { if (columns.includes(e)) score++ })
        } else if (columns.includes(expected)) score++
      }
      if (score > bestScore) { bestScore = score; bestName = name; bestMap = colMap }
    }
    setDetectedTemplate(bestName)
    // Pre-fill mapping
    const m = {}
    for (const [role] of ROLES) {
      const expected = bestMap[role]
      if (expected && columns.includes(expected)) m[role] = expected
    }
    const ph = Array.isArray(bestMap.phone_columns)
      ? bestMap.phone_columns.filter(c => columns.includes(c))
      : []
    setMapping(m)
    setPhoneColumns(ph)
  }

  function applyMapping() {
    onMappingChange({ ...mapping, phone_columns: phoneColumns })
  }

  function setRole(role, value) {
    setMapping(prev => ({ ...prev, [role]: value }))
  }

  const options = ['', ...columns]

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {['auto', 'manual'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors
              ${tab === t ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === 'auto' ? 'Auto Match' : 'Manual'}
          </button>
        ))}
      </div>

      {tab === 'auto' && detectedTemplate && (
        <div className="text-xs bg-violet-50 text-violet-700 rounded px-2 py-1 mb-3">
          Detected template: <strong>{detectedTemplate}</strong>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {ROLES.map(([role, label]) => (
          <div key={role} className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-32 shrink-0">{label}</label>
            <select
              value={mapping[role] || ''}
              onChange={e => setRole(role, e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-violet-400"
            >
              {options.map(o => <option key={o} value={o}>{o || '(unmapped)'}</option>)}
            </select>
          </div>
        ))}

        {/* Phone columns multi-select */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Phone Columns</label>
          <div className="border border-gray-200 rounded p-2 max-h-28 overflow-y-auto space-y-1">
            {columns.map(col => (
              <label key={col} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={phoneColumns.includes(col)}
                  onChange={e => setPhoneColumns(prev =>
                    e.target.checked ? [...prev, col] : prev.filter(c => c !== col))}
                  className="accent-violet-600" />
                {col}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button onClick={applyMapping}
        className="mt-3 w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
        Apply Mapping
      </button>
    </div>
  )
}
