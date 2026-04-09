import axios from 'axios'

export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await axios.post('/api/upload', form)
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

export function downloadUrl(sessionId) {
  return `/api/download/${sessionId}`
}
