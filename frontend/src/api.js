import axios from 'axios'

export async function uploadFile(file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await axios.post('/api/upload', form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
  return data
}

export async function getConfig() {
  const { data } = await axios.get('/api/config')
  return data
}

export async function startPipeline(sessionId, columnMapping, stepToggles, thresholds) {
  const { data } = await axios.post('/api/run-pipeline', {
    session_id:     sessionId,
    column_mapping: columnMapping,
    step_toggles:   stepToggles,
    thresholds,
  })
  return data  // { job_id, status }
}

export async function pollJobStatus(jobId) {
  const { data } = await axios.get(`/api/pipeline-status/${jobId}`)
  return data
}

export async function cancelPipeline(jobId) {
  const { data } = await axios.post(`/api/cancel-pipeline/${jobId}`)
  return data
}

export function downloadUrl(sessionId) {
  return `/api/download/${sessionId}`
}

// ── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates() {
  const { data } = await axios.get('/api/templates')
  return data
}

export async function saveTemplate(name, payload) {
  const { data } = await axios.post(`/api/templates/${name}`, payload)
  return data
}

export async function deleteTemplate(name) {
  const { data } = await axios.delete(`/api/templates/${name}`)
  return data
}

// ── Batch ──────────────────────────────────────────────────────────────────

export async function batchUpload(files, onProgress) {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  const { data } = await axios.post('/api/batch/upload', form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}

export async function runBatch(batchId, columnMapping, stepToggles, thresholds) {
  const { data } = await axios.post('/api/batch/run', {
    batch_id:       batchId,
    column_mapping: columnMapping,
    step_toggles:   stepToggles,
    thresholds,
  })
  return data
}

export async function pollBatchStatus(batchId) {
  const { data } = await axios.get(`/api/batch/status/${batchId}`)
  return data
}

export async function cancelBatch(batchId) {
  const { data } = await axios.post(`/api/batch/cancel/${batchId}`)
  return data
}
