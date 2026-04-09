import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

function nullColor(pct) {
  if (pct >= 50) return 'bg-red-100 text-red-700'
  if (pct >= 20) return 'bg-orange-100 text-orange-700'
  if (pct > 0)   return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-50 text-green-700'
}

const BAR_COLORS = [
  '#7c3aed','#8b5cf6','#a78bfa','#c4b5fd','#6d28d9',
  '#5b21b6','#4c1d95','#9333ea','#a855f7','#c026d3',
]

export default function DataPreview({ fileInfo, previewRows, dataQuality }) {
  const [tab, setTab]         = useState('table')
  const [filter, setFilter]   = useState('')
  const [exploreCol, setExploreCol] = useState(null)
  const [topN, setTopN]       = useState(10)
  const [filterVals, setFilterVals] = useState([])

  const cols = fileInfo?.column_names || []

  const filteredRows = previewRows?.filter(row =>
    row.some(cell => String(cell ?? '').toLowerCase().includes(filter.toLowerCase()))
  ) ?? []

  // Column explorer data
  const exploreIdx = exploreCol != null ? cols.indexOf(exploreCol) : -1
  const explorerCounts = exploreIdx >= 0
    ? (() => {
        const counts = {}
        previewRows?.forEach(row => {
          const v = row[exploreIdx]
          const key = v == null ? '(empty)' : String(v)
          counts[key] = (counts[key] || 0) + 1
        })
        return Object.entries(counts).sort((a, b) => b[1] - a[1])
      })()
    : []

  const topEntries   = explorerCounts.slice(0, topN)
  const chartData    = topEntries.map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 16) + '…' : name, value, fullName: name }))
  const totalRows    = previewRows?.length || 1

  // For column explorer metrics
  const exploreNonNull = exploreIdx >= 0 ? previewRows?.filter(r => r[exploreIdx] != null && r[exploreIdx] !== '').length : 0
  const exploreNull    = (previewRows?.length || 0) - exploreNonNull
  const exploreUnique  = explorerCounts.length

  return (
    <div className="flex flex-col h-full">
      {/* Metrics */}
      {fileInfo && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Rows',       value: fileInfo.rows?.toLocaleString() },
            { label: 'Columns',    value: fileInfo.columns },
            { label: 'Total Nulls',value: dataQuality?.reduce((s, r) => s + r.null_count, 0)?.toLocaleString() },
            { label: 'Fill Rate',  value: (() => {
              const total = (fileInfo.rows || 0) * (fileInfo.columns || 1)
              const nulls = dataQuality?.reduce((s, r) => s + r.null_count, 0) || 0
              return total ? `${(((total - nulls) / total) * 100).toFixed(1)}%` : '—'
            })() },
            { label: 'File Type',  value: fileInfo.file_name?.split('.').pop().toUpperCase() },
          ].map(m => (
            <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-violet-700">{m.value}</div>
              <div className="text-xs text-gray-400">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {['table', 'quality', 'explorer'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-sm font-medium capitalize transition-colors whitespace-nowrap
              ${tab === t ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === 'table' ? 'Table View' : t === 'quality' ? 'Data Quality' : 'Column Explorer'}
          </button>
        ))}
      </div>

      {/* ── Table View ── */}
      {tab === 'table' && (
        <>
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter rows..."
            className="border border-gray-200 rounded px-3 py-1.5 text-sm mb-2 w-full focus:outline-none focus:border-violet-400" />
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

      {/* ── Data Quality ── */}
      {tab === 'quality' && (
        <div className="flex-1 overflow-auto rounded border border-gray-200">
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

      {/* ── Column Explorer ── */}
      {tab === 'explorer' && (
        <div className="flex flex-col md:flex-row gap-4 flex-1 overflow-hidden">
          {/* Column list — horizontal scroll on mobile, vertical on desktop */}
          <div className="md:w-44 shrink-0 border border-gray-200 rounded flex md:flex-col flex-row overflow-x-auto md:overflow-x-hidden md:overflow-y-auto">
            {cols.map(c => (
              <div key={c} onClick={() => { setExploreCol(c); setFilterVals([]) }}
                className={`px-3 py-1.5 text-xs cursor-pointer border-r md:border-r-0 border-b border-gray-100 whitespace-nowrap md:truncate shrink-0 md:shrink
                  ${exploreCol === c ? 'bg-violet-600 text-white' : 'hover:bg-violet-50 text-gray-700'}`}>
                {c}
              </div>
            ))}
          </div>

          {/* Explorer detail */}
          {exploreCol ? (
            <div className="flex-1 overflow-auto space-y-4">
              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Non-Null', value: exploreNonNull?.toLocaleString(), color: 'text-green-600' },
                  { label: 'Null',     value: exploreNull?.toLocaleString(),    color: 'text-red-500' },
                  { label: 'Unique',   value: exploreUnique?.toLocaleString(),  color: 'text-violet-700' },
                  { label: 'Null %',   value: `${totalRows ? ((exploreNull / totalRows) * 100).toFixed(1) : 0}%`, color: 'text-gray-600' },
                ].map(m => (
                  <div key={m.label} className="bg-white border border-gray-200 rounded p-2 text-center">
                    <div className={`text-base font-bold ${m.color}`}>{m.value}</div>
                    <div className="text-xs text-gray-400">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Top-N selector + bar chart */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">Value Distribution</p>
                  <select value={topN} onChange={e => setTopN(+e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-violet-400">
                    {[5, 10, 20, 50].map(n => <option key={n} value={n}>Top {n}</option>)}
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(160, topEntries.length * 28)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 30 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={110} />
                    <Tooltip formatter={(v, _, p) => [v, p.payload.fullName]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Value table */}
              <div className="rounded border border-gray-200 overflow-auto max-h-48">
                <table className="text-xs w-full border-collapse">
                  <thead className="bg-violet-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-violet-800 border-b border-gray-200">Value</th>
                      <th className="px-3 py-2 text-left font-semibold text-violet-800 border-b border-gray-200">Count</th>
                      <th className="px-3 py-2 text-left font-semibold text-violet-800 border-b border-gray-200">% of Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topEntries.map(([val, cnt], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-gray-700 max-w-xs truncate">{val}</td>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500">{cnt}</td>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-gray-400">{totalRows ? ((cnt / totalRows) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Filter rows */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Filter rows by value</p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto mb-2">
                  {explorerCounts.slice(0, 100).map(([val]) => (
                    <button key={val} onClick={() => setFilterVals(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors
                        ${filterVals.includes(val) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'}`}>
                      {val}
                    </button>
                  ))}
                </div>
                {filterVals.length > 0 && (
                  <p className="text-xs text-gray-400">
                    {previewRows?.filter(r => filterVals.includes(r[exploreIdx] == null ? '(empty)' : String(r[exploreIdx]))).length?.toLocaleString()} rows match
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm mt-4">Select a column to explore</p>
          )}
        </div>
      )}
    </div>
  )
}
