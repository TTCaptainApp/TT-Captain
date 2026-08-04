import { Link, useLocation } from 'react-router-dom'

function BottomNav({ istAdmin }) {
  const location = useLocation()
  const items = [
    { to: '/', label: 'Start', icon: '🏠' },
    { to: '/spiele', label: 'Spiele', icon: '📅' },
    { to: '/chats', label: 'Chats', icon: '💬' },
  ]
  if (istAdmin) items.push({ to: '/mannschaften', label: 'Mannschaften', icon: '👥' })

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, background: '#ffffff',
      borderTop: '1px solid #DCE7E2', display: 'flex', padding: '8px 0 max(10px, env(safe-area-inset-bottom))',
      zIndex: 10
    }}>
      {items.map(item => {
        const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/')
        return (
          <Link
            key={item.to}
            to={item.to}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              textDecoration: 'none', color: active ? '#1C8A4E' : '#5B6D66',
              fontSize: 11, fontWeight: active ? 700 : 500, fontFamily: 'Inter, sans-serif'
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

export default BottomNav 
