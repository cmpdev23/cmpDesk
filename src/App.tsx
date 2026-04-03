import { Routes, Route } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import Home from './pages/Home'

/**
 * Application principale cmpDesk
 * 
 * Toutes les pages passent par AppLayout qui fournit:
 * - Sidebar (navigation)
 * - Topbar (header)
 * - Zone de contenu principale
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Home />} />
        {/* Futures routes ici */}
        {/* <Route path="dossiers" element={<Dossiers />} /> */}
        {/* <Route path="settings" element={<Settings />} /> */}
      </Route>
    </Routes>
  )
}

export default App
