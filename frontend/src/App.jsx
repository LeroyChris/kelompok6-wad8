import { useState } from 'react'
import './index.css'
import { getToken, getStoredUser, clearSession } from '@/services/api'
import { initials } from '@/lib/util'
import AuthPage from '@/pages/AuthPage'
import OverviewPage from '@/pages/OverviewPage'
import CirclesPage from '@/pages/CirclesPage'
import CircleDetailPage from '@/pages/CircleDetailPage'
import CyclePage from '@/pages/CyclePage'
import WalletPage from '@/pages/WalletPage'
import ProfilePage from '@/pages/ProfilePage'

const NAV = [
  { key: 'overview', label: 'Overview', icon: '⌂' },
  { key: 'circles', label: 'My circles', icon: '▦' },
  { key: 'wallet', label: 'Wallet', icon: '▣' },
  { key: 'profile', label: 'Profile', icon: '✦' },
]

const TODAY = new Date().toLocaleDateString('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const Brand = () => (
  <div className="brand">
    <div className="brand-mark">◎</div>
    <div>
      <div className="brand-name">ArisanKita</div>
      <div className="brand-sub">Shared savings</div>
    </div>
  </div>
)

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null))
  const [route, setRoute] = useState({ name: 'overview' })

  if (!getToken() || !user) {
    return (
      <AuthPage
        onAuthenticated={(u) => {
          setUser(u)
          setRoute({ name: 'overview' })
        }}
      />
    )
  }

  const navigate = (next) => setRoute(next)
  const logout = () => {
    clearSession()
    setUser(null)
  }

  const activeKey = route.name === 'circle' || route.name === 'cycle' ? 'circles' : route.name

  let content
  switch (route.name) {
    case 'circles':
      content = <CirclesPage navigate={navigate} user={user} />
      break
    case 'circle':
      content = <CircleDetailPage circleId={route.circleId} navigate={navigate} user={user} />
      break
    case 'cycle':
      content = <CyclePage cycleId={route.cycleId} circleId={route.circleId} navigate={navigate} user={user} />
      break
    case 'wallet':
      content = <WalletPage />
      break
    case 'profile':
      content = <ProfilePage user={user} onUserUpdate={setUser} />
      break
    default:
      content = <OverviewPage navigate={navigate} user={user} />
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand />
        <nav className="nav">
          <p className="nav-title">Workspace</p>
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeKey === item.key ? 'active' : ''}
              onClick={() => navigate({ name: item.key })}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div className="secure" style={{ marginTop: '16px' }}>
            <strong>✦ Protected account</strong>
            Every contribution is tracked with a clear audit trail.
          </div>
        </nav>
        <button type="button" className="nav" style={{ flex: 0, textAlign: 'right' }} onClick={logout}>
          Sign out
        </button>
      </aside>

      <div className="content">
        <header className="topbar">
          <div>
            <div className="date">{TODAY}</div>
            <h1>Halo, {user.full_name || 'Anggota'}</h1>
          </div>
          <div className="top-actions">
            <span>♧</span>
            <div className="avatar">{initials(user.full_name)}</div>
          </div>
        </header>
        <main className="main">{content}</main>
      </div>
    </div>
  )
}
