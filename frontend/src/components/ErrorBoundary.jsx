import React from 'react'

/** Catches render errors so one broken page shows a message instead of a blank screen. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-rose-500/30 bg-slate-900 p-6">
          <h1 className="text-lg font-semibold text-white">This page hit an error</h1>
          <p className="mt-2 text-sm text-slate-300">You are still signed in. Go back or reload the page to try again.</p>
          <pre className="mt-4 max-h-40 overflow-auto rounded bg-slate-950 p-3 text-xs text-rose-300">{String(this.state.error?.message || this.state.error)}</pre>
          <div className="mt-4 flex gap-2">
            <button onClick={() => window.history.back()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Go back</button>
            <button onClick={() => window.location.reload()} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white">Reload</button>
          </div>
        </div>
      </div>
    )
  }
}
