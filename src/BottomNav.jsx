import { Link, useLocation } from 'react-router-dom'

export function BottomNav({ istAdmin }) {
  const location = useLocation()
  const path = location.pathname

  const itemStyle = (aktiv) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textDecoration: 'none',
    fontSize: 11,
    fontWeight: aktiv ? 700 : 500,
    color: aktiv ? '#1C8A4E' : '#5B6D66',
    gap: 2
  })

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#ffffff',
      borderTop: '1px solid #DCE7E2',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '8px 0 12px',
      maxWidth: 480,
      margin: '0 auto',
      zIndex: 100
    }}>
      <Link to="/" style={itemStyle(path === '/')}>
        <span style={{ fontSize: 18 }}>🏠</span>
        <span>Start</span>
      </Link>

      <Link to="/spiele" style={itemStyle(path.startsWith('/spiele'))}>
        <span style={{ fontSize: 18 }}>📅</span>
        <span>Spiele</span>
      </Link>

      <Link to="/chats" style={itemStyle(path.startsWith('/chat'))}>
        <span style={{ fontSize: 18 }}>💬</span>
        <span>Chats</span>
      </Link>

      <Link to="/mannschaften" style={itemStyle(path.startsWith('/mannschaften'))}>
        <span style={{ fontSize: 18 }}>👥</span>
        <span>Teams</span>
      </Link>

      <Link to="/profil" style={itemStyle(path === '/profil' || path === '/admin')}>
        <span style={{ fontSize: 18 }}>👤</span>
        <span>Profil</span>
      </Link>
    </div>
  )
}

export default BottomNav
