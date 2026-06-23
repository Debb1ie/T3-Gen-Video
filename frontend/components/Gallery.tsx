'use client'

import { useState, useEffect, useRef } from 'react'
import { getGallery, resolveVideoUrl, type GalleryVideo } from '@/lib/api'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function VideoCard({ video }: { video: GalleryVideo }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const src = resolveVideoUrl(video.url)

  function togglePlay() {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      el.play()
      setIsPlaying(true)
    } else {
      el.pause()
      setIsPlaying(false)
    }
  }

  function handleDownload() {
    const a = document.createElement('a')
    a.href = src
    a.download = video.filename
    a.click()
  }

  return (
    <div className="group bg-surface border border-border rounded-2xl overflow-hidden hover:border-border-2 transition-all">
      {/* Video */}
      <div className="relative aspect-square bg-bg cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          loop
          playsInline
          className="w-full h-full object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-white text-lg pl-0.5">▶</span>
            </div>
          </div>
        )}
        {isPlaying && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-mono">
              LIVE
            </span>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="p-3 space-y-2">
        <p className="text-xs font-mono text-muted truncate" title={video.filename}>
          {video.filename}
        </p>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{formatDate(video.created_at)}</span>
          <span>{formatBytes(video.size_bytes)}</span>
        </div>
        <button
          onClick={handleDownload}
          className="w-full py-1.5 rounded-lg text-xs border border-border text-muted hover:text-text hover:border-border-2 hover:bg-surface-2 transition-colors"
        >
          ↓ Download
        </button>
      </div>
    </div>
  )
}

export default function Gallery() {
  const [videos, setVideos] = useState<GalleryVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await getGallery()
      setVideos(data.videos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // Auto-refresh every 30 seconds
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gallery</h1>
          <p className="text-muted text-sm mt-1">
            {loading ? 'Loading…' : `${videos.length} video${videos.length !== 1 ? 's' : ''} generated`}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 rounded-xl border border-border bg-surface text-sm text-muted hover:text-text hover:border-border-2 transition-colors disabled:opacity-40"
        >
          {loading ? '…' : '↺ Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-xl text-sm text-error">
          {error}
          <button onClick={refresh} className="ml-3 underline text-xs">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && videos.length === 0 && (
        <div className="py-20 text-center text-muted">
          <p className="text-4xl mb-3">🎬</p>
          <p className="font-medium">No videos yet</p>
          <p className="text-sm mt-1">Generate your first video on the home page.</p>
        </div>
      )}

      {loading && videos.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl bg-surface border border-border animate-pulse"
            />
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v) => (
            <VideoCard key={v.filename} video={v} />
          ))}
        </div>
      )}
    </div>
  )
}
