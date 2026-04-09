import { useState } from 'react'

function nullColor(pct) {
  if (pct >= 50) return 'bg-red-100 text-red-700'
  if (pct >= 20) return 'bg-orange-100 text-orange-700'
  if (pct > 0)   return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-50 text-green-700'
}

export default function DataPreview({ fileInfo, previewRows, dataQuality }) {
  const [tab, setTab]        = useState('table')
  const [filter, setFilter]  = useState('')
  const [exploreCol, setExploreCol] = useState(null)

  const cols = fileInfo?.column_names || []

  const filteredRows = previewRows?.filter(row =>
    row.some(cell => String(cell ?? '').toLowerCase().includes(filter.toLowerCase()))
  ) ?? []

  // Column explorer distribution
  const explorerDist = exploreCol != null
    ? (() => {
        const idx = cols.indexOf(exploreCol)
        const counts = {}
        previewRows?.forEach(row => {
          const v = String(row[idx] ?? '(empty)')
          counts[v] = (counts[v] || 0) + 1
        })
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20)
      })()
    : []

  const tabs = ['table', 'quality', 'explorer']

  return (
    <div className="flex flex-col h-full">
      {/* Metrics row */}
      {fileInfo && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Rows',    value: fileInfo.rows?.toLocaleString() },
            { label: 'Columns', value: fileInfo.columns },
            { label: 'Nulls',   value: dataQuality?.reduce((s, r) => s + r.null_count, 0)?.toLocaleString() },
            { label: 'File',    value: fileInfo.file_name?.split('.').pop().toUpperCase() },
          ].map(m => (
            <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-violet-700">{m.value}</div>
              <div className="text-xs text-gray-400">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-sm font-medium capitalize transition-colors
              ${tab === t ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === 'table' ? 'Table View' : t === 'quality' ? 'Data Quality' : 'Column Explorer'}
          </button>
        ))}
      </div>

      {/* Table View */}
      {tab === 'table' && (
        <>
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter rows..." className="border border-gray-200 rounded px-3 py-1.5 text-sm mb-2 w-full focus:outline-none focus:border-violet-400" />
          <div className="overflow-auto flex-1 rounded border border-gray-200">
            <table className="text-xs w-full border-collapse">
              <thead className="sticky top-0">
                <tr className="bg-violet-50">
                  {cols.map(c => (
                    <th key={c} className="px-3 py-2 text-left font-semibold text-violet-800 border-b border-gray-200 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 200).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap max-w-48 truncate">
                        {cell == null ? <span className="text-gray-300">—</span> : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Data Quality */}
      {tab === 'quality' && (
        <div className="overflow-auto flex-1 rounded border border-gray-200">
          <table className="text-xs w-full border-collapse">
            <thead className="sticky top-0 bg-violet-50">
              <tr>
                {['Column', 'Null %', 'Null Count', 'Unique', 'Samples'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-violet-800 border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataQuality?.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-1.5 border-b border-gray-100 font-medium text-gray-700">{row.column}</td>
                  <td className="px-3 py-1.5 border-b border-gray-100">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${nullColor(row.null_pct)}`}>
                      {row.null_pct}%
                    </span>
                  </td>
                  <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500">{row.null_count}</td>
                  <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500">{row.unique}</td>
                  <td className="px-3 py-1.5 border-b border-gray-100 text-gray-400">{row.samples?.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Column Explorer */}
      {tab === 'explorer' && (
        <div className="flex gap-4 flex-1 overflow-hidden">
          <div className="w-48 overflow-y-auto border border-gray-200 rounded">
            {cols.map(c => (
              <div key={c} onClick={() => setExploreCol(c)}
                className={`px-3 py-1.5 text-xs cursor-pointer border-b border-gray-100 truncate
                  ${exploreCol === c ? 'bg-violet-600 text-white' : 'hover:bg-violet-50 text-gray-700'}`}>
                {c}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {exploreCol ? (
              <table className="text-xs w-full border-collapse border border-gray-200 rounded">
                <thead className="bg-violet-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-violet-800 border-b border-gray-200">Value</th>
                    <th className="px-3 py-2 text-left font-semibold text-violet-800 border-b border-gray-200">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {explorerDist.map(([val, cnt], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 border-b border-gray-100 text-gray-700">{val}</td>
                      <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500">{cnt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-400 text-sm mt-4">Select a column to explore</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
