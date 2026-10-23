import { NavLink, Navigate, Route, Routes } from 'react-router'
import CostsLayout from './pages/CostsLayout.tsx'
import PriceList from './pages/PriceList.tsx'
import Placeholder from './pages/Placeholder.tsx'
import Settings from './pages/Settings.tsx'
import EosPage from './pages/EosPage.tsx'

export default function App() {
  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 28 28">
              <rect x="3" y="5" width="22" height="7" rx="2" fill="none" stroke="#fff" strokeWidth="2.6" />
              <rect x="3" y="16" width="22" height="7" rx="2" fill="none" stroke="#fff" strokeWidth="2.6" />
            </svg>
          </span>
          Network Costs
        </div>
        <nav className="nav">
          <NavLink to="/eos">EOS</NavLink>
          <NavLink to="/costs">Costs</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <span className="spacer" />
        <NavLink to="/settings" className="btn primary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          Upload inventory
        </NavLink>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/costs" replace />} />
          <Route path="/eos" element={<EosPage />} />
          <Route path="/costs" element={<CostsLayout />}>
            <Route index element={<Placeholder title="" step="7d" embedded />} />
            <Route path="prices" element={<PriceList />} />
          </Route>
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Placeholder title="Page not found" />} />
        </Routes>
      </main>
    </>
  )
}
