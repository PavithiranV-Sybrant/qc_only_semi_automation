import { useRef, useState } from 'react'

export default function FileUpload({ onUpload, loading, uploadProgress }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  function handleFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'csv'].includes(ext)) {
      alert('Only .xlsx and .csv files are supported.')
      return
    }
    onUpload(file)
  }

  const showProgress = loading && uploadProgress !== null && uploadProgress !== undefined

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
          ${loading ? 'pointer-events-none opacity-70' : ''}
          ${dragging ? 'border-violet-500 bg-violet-50' : 'border-gray-300 hover:border-violet-400'}`}
        onClick={() => !loading && inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
        <div className="text-3xl mb-2">📂</div>
        {loading
          ? <p className="text-violet-600 text-sm font-medium">Uploading...</p>
          : <>
              <p className="font-medium text-gray-700 text-sm">Drop file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx or .csv</p>
            </>
        }
      </div>

      {/* Upload progress bar */}
      {showProgress && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-violet-600 mb-1">
            <span>Uploading file...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Parsing indicator (upload done but server still processing) */}
      {loading && uploadProgress === 100 && (
        <div className="mt-2 text-xs text-gray-500 text-center animate-pulse">
          Parsing file...
        </div>
      )}
    </div>
  )
}
