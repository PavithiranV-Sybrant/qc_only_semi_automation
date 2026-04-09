import { useState } from 'react'

export default function PipelineAnalysis({ pipelineData }) {
  const [selectedCol, setSelectedCol] = useState(null)

  if (!pipelineData) return (
    <div className="text-gray-400 text-sm text-center py-12">
      Run the pipeline first to see analysis.
    </div>
  )

  const { new_columns, new_cols_summary, distributions } = pipelineData
  const dist = selectedCol ? distributions[selectedCol] : null
  const total = dist ? Object.values(dist).reduce((s, v) => s + v, 0) : 0

  return (
    <div className="space-y-6">
      {/* Overview metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-violet-700">{new_columns?.length ?? 0}</div>
          <div className="text-xs text-gray-400">New Columns Added</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">
            {new_cols_summary?.reduce((s, r) => s + r.populated, 0)?.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">Total Cells Populated</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-500">
            {new_cols_summary?.reduce((s, r) => s + r.null, 0)?.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">Total Nulls in New Columns</div>
        </div>
      </div>

      {/* Deep dive */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Value Distribution Deep Dive</h3>
        <div className="flex gap-4">
          {/* Column selector */}
          <div className="w-56 border border-gray-200 rounded overflow-y-auto max-h-72">
            {new_columns?.map(col => (
              <div key={col} onClick={() => setSelectedCol(col)}
                className={`px-3 py-2 text-xs cursor-pointer border-b border-gray-100 truncate
                  ${selectedCol === col ? 'bg-violet-600 text-white' : 'hover:bg-violet-50 text-gray-700'}`}>
                {col}
              </div>
            ))}
          </div>

          {/* Distribution */}
          <div className="flex-1">
            {dist ? (
              <div className="space-y-1.5">
                {Object.entries(dist).map(([val, cnt]) => {
                  const pct = total ? Math.round(cnt / total * 100) : 0
                  return (
                    <div key={val}>
                      <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                        <span className="truncate max-w-48">{val}</span>
                        <span className="text-gray-400 shrink-0 ml-2">{cnt} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Select a column to see its value distribution</p>
            )}
          </div>
        </div>
      </div>

      {/* Row browser */}
      {selectedCol && dist && (
        <RowBrowser column={selectedCol} distribution={dist} summary={new_cols_summary?.find(r => r.column === selectedCol)} />
      )}
    </div>
  )
}

function RowBrowser({ column, distribution }) {
  const [filter, setFilter] = useState('')
  const values = Object.keys(distribution)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Flag Value Browser — <span className="text-violet-600">{column}</span></h3>
      <div className="flex flex-wrap gap-2">
        {values.map(v => (
          <button key={v} onClick={() => setFilter(f => f === v ? '' : v)}
            className={`text-xs px-2 py-1 rounded border transition-colors
              ${filter === v ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'}`}>
            {v} <span className="text-gray-400 ml-1">({distribution[v]})</span>
          </button>
        ))}
      </div>
      {filter && (
        <p className="text-xs text-gray-400 mt-2">
          Showing rows where <strong className="text-gray-600">{column}</strong> = <strong className="text-violet-600">{filter}</strong> ({distribution[filter]} rows)
        </p>
      )}
    </div>
  )
}
