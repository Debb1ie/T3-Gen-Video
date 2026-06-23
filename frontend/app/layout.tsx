import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gen Vid — Local AI Video Generator',
  description: 'Generate short videos from text prompts using open-source AI, running fully offline.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text">
        <header className="border-b border-border sticky top-0 z-50 bg-bg/90 backdrop-blur-sm">
          <nav className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-text tracking-tight text-lg">
              <span className="text-accent">▶</span>
              Gen Vid
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-sm text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                Generator
              </Link>
              <Link
                href="/gallery"
                className="px-3 py-1.5 rounded-md text-sm text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                Gallery
              </Link>
            </div>
          </nav>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>

        <footer className="border-t border-border mt-20 py-6 text-center text-muted text-xs">
          Fully local · Open-source · No external APIs
        </footer>
      </body>
    </html>
  )
}
