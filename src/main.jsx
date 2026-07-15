import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('App crashed:', err, info) }
  render() {
    if (this.state.err) {
      return (
        <pre style={{ margin: 0, padding: 24, color: '#c0392b', background: '#fff',
          fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {'App error:\n\n' + String(this.state.err?.message || this.state.err) +
            '\n\nOpen the browser console (F12) for the full stack trace.'}
        </pre>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
