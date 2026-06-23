'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  generateVideo,
  getJobStatus,
  resolveVideoUrl,
  type JobStatusResponse,
  type GpuInfo,
  getGpuInfo,
} from '@/lib/api'

const FPS_OPTIONS = [8, 12, 16, 24] as const
const RESOLUTION_OPTIONS = [256, 512, 768] as const
const MAX_DURATION = 15
const POLL_INTERVAL_MS = 2000

type Phase = 'idle' | 'queued' | 'processing' | 'completed' | 'failed'

interface FormState {
  prompt: string
  duration: number
  fps: number
  resolution: number
  seed: string
  showSeed: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function GpuBadge({ info }: { info: GpuInfo | null }) {
  if (!info) return null
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
        info.has_gpu
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-warning/30 bg-warning/10 text-warning'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${info.has_gpu ? 'bg-success' : 'bg-warning'}`} />
      {info.has_gpu ? `${info.gpu_name} · ${info.vram_gb} GB` : 'CPU mode (slow)'}
    </div>
  )
}

function ProgressBar({ progress, phase }: { progress: number; phase: Phase }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {phase === 'queued' && 'Waiting in queue…'}
          {phase === 'processing' && `Generating frames · ${progress.toFixed(0)}%`}
        </span>
        <span>{progress.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        {phase === 'queued' ? (
          <div className="h-full w-1/3 progress-shimmer rounded-full" />
        ) : (
          <div
            className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
    </div>
  )
}

export default function VideoGenerator() {
  const [form, setForm] = useState<FormState>({
    prompt: '',
    duration: 5,
    fps: 12,
    resolution: 512,
    seed: '',
    showSeed: false,
  })
  const [durationWarning, setDurationWarning] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    getGpuInfo().then(setGpuInfo).catch(() => null)
    return () => stopPolling()
  }, [stopPolling])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleDurationChange(raw: number) {
    if (raw > MAX_DURATION) {
      setField('duration', MAX_DURATION)
      setDurationWarning(true)
    } else {
      setField('duration', raw)
      setDurationWarning(false)
    }
  }

  async function handleGenerate() {
    if (!form.prompt.trim()) return
    stopPolling()
    setPhase('queued')
    setJobStatus(null)
    setVideoUrl(null)
    setError(null)

    try {
      const { job_id } = await generateVideo({
        prompt: form.prompt.trim(),
        duration: Math.min(form.duration, MAX_DURATION),
        fps: form.fps,
        resolution: form.resolution,
        seed: form.seed ? parseInt(form.seed, 10) : undefined,
      })

      pollRef.current = setInterval(async () => {
        try {
          const status = await getJobStatus(job_id)
          setJobStatus(status)

          if (status.status === 'processing') {
            setPhase('processing')
          }

          if (status.status === 'completed' && status.video_url) {
            stopPolling()
            setVideoUrl(resolveVideoUrl(status.video_url))
            setPhase('completed')
            setTimeout(() => {
              previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 150)
          }

          if (status.status === 'failed') {
            stopPolling()
            setError(status.error ?? 'Generation failed. Check the backend logs.')
            setPhase('failed')
          }
        } catch {
          // Network hiccup — keep polling
        }
      }, POLL_INTERVAL_MS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation.')
      setPhase('failed')
    }
  }

  function handleRegenerate() {
    handleGenerate()
  }

  function handleDownload() {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = videoUrl.split('/').pop() ?? 'video.mp4'
    a.click()
  }

  const isGenerating = phase === 'queued' || phase === 'processing'
  const progress = jobStatus?.progress ?? 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Text to Video</h1>
          <p className="text-muted text-sm mt-1">Generate short videos from a text description</p>
        </div>
        <GpuBadge info={gpuInfo} />
      </div>

      {/* GPU warning */}
      {gpuInfo?.warning && (
        <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-warning text-sm">
          ⚠ {gpuInfo.warning}
        </div>
      )}

      {/* Prompt */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted uppercase tracking-widest">Prompt</label>
        <textarea
          value={form.prompt}
          onChange={(e) => setField('prompt', e.target.value)}
          placeholder="A drone shot flying over a misty mountain range at sunrise…"
          rows={4}
          disabled={isGenerating}
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted resize-none outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors disabled:opacity-50"
        />
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Duration */}
        <div className="space-y-3 col-span-1 sm:col-span-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted uppercase tracking-widest">
              Duration
            </label>
            <span className="text-sm font-mono text-accent">{form.duration}s</span>
          </div>
          <input
            type="range"
            min={1}
            max={MAX_DURATION}
            step={1}
            value={form.duration}
            disabled={isGenerating}
            onChange={(e) => handleDurationChange(Number(e.target.value))}
            className="w-full disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-muted">
            <span>1s</span>
            <span>5s</span>
            <span>10s</span>
            <span>15s max</span>
          </div>
          {durationWarning && (
            <p className="text-xs text-warning">
              ⚠ Duration capped at 15 seconds (system maximum)
            </p>
          )}
        </div>

        {/* FPS */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted uppercase tracking-widest">FPS</label>
          <div className="flex gap-1.5 flex-wrap">
            {FPS_OPTIONS.map((f) => (
              <button
                key={f}
                disabled={isGenerating}
                onClick={() => setField('fps', f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors disabled:opacity-50 ${
                  form.fps === f
                    ? 'bg-accent border-accent text-white'
                    : 'bg-surface border-border text-muted hover:border-border-2 hover:text-text'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted uppercase tracking-widest">
            Resolution
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {RESOLUTION_OPTIONS.map((r) => (
              <button
                key={r}
                disabled={isGenerating}
                onClick={() => setField('resolution', r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors disabled:opacity-50 ${
                  form.resolution === r
                    ? 'bg-accent border-accent text-white'
                    : 'bg-surface border-border text-muted hover:border-border-2 hover:text-text'
                }`}
              >
                {r}p
              </button>
            ))}
          </div>
        </div>

        {/* Seed toggle + input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted uppercase tracking-widest">Seed</label>
            <button
              onClick={() => setField('showSeed', !form.showSeed)}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              {form.showSeed ? 'hide' : 'set seed'}
            </button>
          </div>
          {form.showSeed && (
            <input
              type="number"
              value={form.seed}
              disabled={isGenerating}
              onChange={(e) => setField('seed', e.target.value)}
              placeholder="Random if empty"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm font-mono text-text placeholder:text-muted outline-none focus:border-accent transition-colors disabled:opacity-50"
            />
          )}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !form.prompt.trim()}
        className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
            Generating…
          </span>
        ) : (
          'Generate Video'
        )}
      </button>

      {/* Progress */}
      {(phase === 'queued' || phase === 'processing') && (
        <div className="p-4 bg-surface rounded-xl border border-border animate-fade-in space-y-3">
          <ProgressBar progress={progress} phase={phase} />
          {jobStatus?.settings_adjusted && (
            <p className="text-xs text-warning">ℹ {jobStatus.settings_adjusted}</p>
          )}
        </div>
      )}

      {/* Error */}
      {phase === 'failed' && error && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-xl text-sm text-error animate-fade-in">
          <p className="font-semibold mb-1">Generation failed</p>
          <p className="font-mono text-xs opacity-80">{error}</p>
          <button
            onClick={handleRegenerate}
            className="mt-3 px-3 py-1.5 rounded-lg border border-error/40 text-error text-xs hover:bg-error/10 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Video preview */}
      {phase === 'completed' && videoUrl && (
        <div ref={previewRef} className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Preview</h2>
            {jobStatus?.settings_adjusted && (
              <span className="text-xs text-warning">ℹ {jobStatus.settings_adjusted}</span>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden bg-surface border border-border">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="w-full max-h-[60vh] object-contain"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 rounded-xl border border-border bg-surface text-sm font-medium text-text hover:bg-surface-2 hover:border-border-2 transition-colors"
            >
              ↓ Download MP4
            </button>
            <button
              onClick={handleRegenerate}
              className="flex-1 py-2.5 rounded-xl border border-accent/40 bg-accent/10 text-sm font-medium text-accent hover:bg-accent/20 transition-colors"
            >
              ↺ Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
