import { useRef, useState } from 'react'

export default function FileUpload({ onUpload, loading, uploadProgress, fileInfo, onClear }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  function handleFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      alert('Only .xlsx, .xls, .csv files are supported.')
      return
    }
    onUpload(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  if (fileInfo) {
    return (
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-2">
        <div className="text-violet-500 mt-0.5">📄</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-800 truncate">{fileInfo.file_name}</p>
          <p className="text-xs text-violet-500">{fileInfo.total_rows?.toLocaleString()} rows · {fileInfo.total_columns} columns</p>
        </div>
        <button onClick={onClear} className="text-violet-400 hover:text-red-500 text-xs shrink-0">✕</button>
      </div>
    )
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all
        ${dragging ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-400 hover:bg-violet-50/50'}`}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e => handleFile(e.target.files[0])} />
      {loading ? (
        <div className="space-y-2">
          <div className="text-sm text-violet-600 font-medium">Uploading…</div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all"
              style={{ width: `${uploadProgress || 0}%` }} />
          </div>
        </div>
      ) : (
        <>
          <div className="text-3xl mb-2">📁</div>
          <p className="text-sm font-medium text-gray-600">Drop file here or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</p>
        </>
      )}
    </div>
  )
}
