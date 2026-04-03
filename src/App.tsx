import { Routes, Route } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import Home from './pages/Home'
import Logs from './pages/Logs'
import Dossiers from './pages/Dossiers'
import { TooltipProvider } from '@/components/ui/tooltip'

/**
 * Application principale cmpDesk
 *
 * Toutes les pages passent par AppLayout qui fournit:
 * - Sidebar (navigation, shadcn Sidebar)
 * - Topbar (header)
 * - Zone de contenu principale
 *
 * TooltipProvider wraps everything as required by shadcn Sidebar.
 */
function App() {
  return (
    <TooltipProvider>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="dossiers" element={<Dossiers />} />
          <Route path="logs" element={<Logs />} />
          {/* Futures routes ici */}
          {/* <Route path="settings" element={<Settings />} /> */}
        </Route>
      </Routes>
    </TooltipProvider>
  )
}

export default App
