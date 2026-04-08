import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'

// Import shadcn design system styles
import './index.css'

/**
 * Using HashRouter instead of BrowserRouter because:
 * - BrowserRouter uses HTML5 History API which requires a server
 * - In packaged Electron apps, we use file:// protocol
 * - HashRouter uses URL hash (#/path) which works with file://
 *
 * Routes will appear as: file:///.../index.html#/search
 * instead of: file:///.../search (which would fail)
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
