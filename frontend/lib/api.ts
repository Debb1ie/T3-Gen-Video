const API_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface GenerateRequest {
  prompt: string
  duration: number
  fps: number
  resolution: number
  seed?: number
}

export interface GenerateResponse {
  job_id: string
  status: string
  capped_duration: number
}

export interface JobStatusResponse {
  job_id: string
  status: JobStatus
  progress: number
  video_url: string | null
  error: string | null
  settings_adjusted: string | null
  created_at: string
}

export interface GalleryVideo {
  filename: string
  url: string
  created_at: string
  size_bytes: number
}

export interface GalleryResponse {
  videos: GalleryVideo[]
  count: number
}

export interface GpuInfo {
  has_gpu: boolean
  device: string
  vram_gb: number
  free_vram_gb: number
  gpu_name: string
  cuda_version: string | null
  warning: string | null
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function generateVideo(req: GenerateRequest): Promise<GenerateResponse> {
  return apiFetch<GenerateResponse>('/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return apiFetch<JobStatusResponse>(`/status/${jobId}`)
}

export async function getGallery(): Promise<GalleryResponse> {
  return apiFetch<GalleryResponse>('/gallery')
}

export async function getGpuInfo(): Promise<GpuInfo> {
  return apiFetch<GpuInfo>('/gpu-info')
}

export function resolveVideoUrl(url: string): string {
  if (url.startsWith('http')) return url
  return `${API_URL}${url}`
}
