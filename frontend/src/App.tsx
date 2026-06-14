import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Setup from './pages/Setup'
import Connect from './pages/Connect'
import Dashboard from './pages/Dashboard'
import Account from './pages/Account'
import Settings from './pages/Settings'
import { loadKey } from './lib/keystore'
import Spinner from './components/ui/Spinner'
import ErrorBoundary from './components/ErrorBoundary'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

function RequireKey({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading')
  useEffect(() => {
    loadKey().then((kv) => setStatus(kv ? 'ok' : 'missing'))
  }, [])
  if (status === 'loading') return <div className="flex-1 flex items-center justify-center"><Spinner size={24} /></div>
  if (status === 'missing') return <Navigate to="/setup" replace />
  return <>{children}</>
}

function RootRedirect() {
  const [dest, setDest] = useState<string | null>(null)
  useEffect(() => {
    loadKey().then((kv) => setDest(kv ? '/dashboard' : '/setup'))
  }, [])
  if (!dest) return <div className="flex-1 flex items-center justify-center"><Spinner size={24} /></div>
  return <Navigate to={dest} replace />
}

export default function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/dashboard" element={<RequireKey><Dashboard /></RequireKey>} />
          <Route path="/account/:uid" element={<RequireKey><Account /></RequireKey>} />
          <Route path="/settings" element={<RequireKey><Settings /></RequireKey>} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  )
}
